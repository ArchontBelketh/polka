import path from "node:path"
import { Driver, IamAuthService, TokenAuthService, getSACredentialsFromJson, TypedData, identityConversion, AUTO_TX, ExecuteQuerySettings, OperationParams, StatusCode, type Ydb } from "ydb-sdk"

export type Row = Record<string, unknown>
export type Params = Record<string, Ydb.ITypedValue>
export type Executor = (text: string, parameters?: Params) => Promise<Row[][]>

let driverPromise: Promise<Driver> | undefined
class NativeRow extends TypedData { static __options = { namesConversion: identityConversion } }

export function getYdbDriver(): Promise<Driver> {
  if (!driverPromise) driverPromise = createDriver().catch((error) => { driverPromise = undefined; throw error })
  return driverPromise
}

async function createDriver() {
  const endpoint = process.env.YDB_ENDPOINT?.trim()
  const database = process.env.YDB_DATABASE?.trim()
  if (!endpoint?.startsWith("grpcs://") || !database?.startsWith("/")) throw new Error("YDB_ENDPOINT and YDB_DATABASE are required")
  const key = process.env.YDB_SERVICE_ACCOUNT_KEY_FILE
  const token = process.env.YDB_ACCESS_TOKEN_CREDENTIALS
  const authService = key ? new IamAuthService(getSACredentialsFromJson(path.resolve(key)))
    : token ? new TokenAuthService(token)
    : undefined
  if (!authService) throw new Error("Configure YDB_SERVICE_ACCOUNT_KEY_FILE or YDB_ACCESS_TOKEN_CREDENTIALS")
  const driver = new Driver({ connectionString: `${endpoint.replace(/\/$/, "")}${database}`, authService, poolSettings: { minLimit: 0, maxLimit: 10 } })
  try {
    if (!await driver.ready(15_000)) throw new Error("YDB connection timed out")
    return driver
  } catch (error) {
    await driver.destroy()
    throw error
  }
}

export async function ydbQuery(text: string, parameters: Params = {}): Promise<Row[][]> {
  const driver = await getYdbDriver()
  return driver.tableClient.withSession(async (session) => {
    const result = await session.executeQuery(text, parameters, AUTO_TX, querySettings())
    return decodeSets(result.resultSets)
  }, 15_000)
}

function querySettings() {
  return new ExecuteQuerySettings().withIdempotent(false).withOperationParams(new OperationParams().withOperationTimeoutSeconds(15))
}
function decodeSets(sets: Ydb.IResultSet[] | null | undefined): Row[][] {
  return (sets || []).map((set) => {
    if (set.truncated) throw new Error("YDB result was truncated; use bounded pagination")
    return NativeRow.createNativeObjects(set).map((row) => ({ ...row }))
  })
}

/** Retry only a confirmed ABORTED transaction. In particular, an ambiguous
 * commit, network timeout or UNDETERMINED result never reruns money writes. */
export async function ydbTransaction<T>(fn: (execute: Executor) => Promise<T>): Promise<T> {
  const driver = await getYdbDriver()
  for (let attempt = 0; ; attempt++) {
    try {
      return await driver.tableClient.withSession(async (session) => {
        const { id } = await session.beginTransaction({ serializableReadWrite: {} })
        if (!id) throw new Error("YDB transaction ID missing")
        let tail: Promise<unknown> = Promise.resolve()
        const execute: Executor = (text, params) => {
          const pending = tail.then(async () => decodeSets((await session.executeQuery(text, params, { txId: id }, querySettings())).resultSets))
          tail = pending
          return pending
        }
        try {
          const result = await fn(execute)
          await tail
          // v5's standalone commitTransaction retries individual RPCs and can
          // hide ABORTED behind a later NOT_FOUND. Commit through executeQuery
          // with idempotent=false so the original outcome reaches this runner.
          const commit = { txId: id, commitTx: true }
          await session.executeQuery("SELECT 1;", {}, commit, querySettings())
          return result
        } catch (error) {
          await session.rollbackTransaction({ txId: id }).catch(() => {})
          throw error
        }
      }, 15_000)
    } catch (error) {
      const status = (error as Error)?.constructor as typeof Error & { status?: number }
      if (status?.status !== StatusCode.ABORTED || attempt >= 7) throw error
      await new Promise((resolve) => setTimeout(resolve, Math.min(250, 15 * 2 ** attempt) + Math.random() * 25))
    }
  }
}

export async function disconnectYdb() {
  const pending = driverPromise
  driverPromise = undefined
  if (pending) await (await pending).destroy()
}
