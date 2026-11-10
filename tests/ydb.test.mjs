import test from "node:test"
import assert from "node:assert/strict"
import { loadModule } from "./helpers/load-module.mjs"

function connection({ commits = [], queryDelay = 0 } = {}) {
  const calls = { begin: 0, commit: 0, rollback: 0, active: 0, maxActive: 0 }
  class Settings {
    withIdempotent() { return this }
    withOperationParams() { return this }
    withOperationTimeoutSeconds() { return this }
  }
  class Native { static createNativeObjects(set) { return set.rows || [] } }
  const session = {
    async beginTransaction() { return { id: String(++calls.begin) } },
    async commitTransaction() { throw new Error("Do not use the SDK method that retries commit RPCs") },
    async rollbackTransaction() { calls.rollback++ },
    async executeQuery(_text, _params, control) {
      if (control.commitTx) {
        const error = commits[calls.commit++]
        if (error) throw error
        return { resultSets: [] }
      }
      calls.active++
      calls.maxActive = Math.max(calls.maxActive, calls.active)
      await new Promise((resolve) => setTimeout(resolve, queryDelay))
      calls.active--
      return { resultSets: [{ rows: [{ one: 1 }] }] }
    },
  }
  class Driver {
    tableClient = { withSession: (fn) => fn(session) }
    async ready() { return true }
    async destroy() {}
  }
  const sdk = { Driver, IamAuthService: class {}, MetadataAuthService: class {}, TokenAuthService: class {},
    getSACredentialsFromJson() { return {} }, TypedData: Native, identityConversion: {}, AUTO_TX: {},
    ExecuteQuerySettings: Settings, OperationParams: Settings, StatusCode: { ABORTED: 400040 } }
  const loaded = loadModule("src/lib/ydb/connection.ts", {
    mocks: { "ydb-sdk": sdk },
    env: { YDB_ENDPOINT: "grpcs://example.invalid:2135", YDB_DATABASE: "/test", YDB_SERVICE_ACCOUNT_KEY_FILE: "unused.json" },
  })
  return { ...loaded, calls }
}

test("YDB retries the complete transaction only after confirmed ABORTED", async () => {
  class Aborted extends Error { static status = 400040 }
  const db = connection({ commits: [new Aborted("conflict")] })
  let attempts = 0
  const result = await db.ydbTransaction(async (execute) => { attempts++; await execute("SELECT 1"); return 42 })
  assert.equal(result, 42)
  assert.equal(attempts, 2)
  assert.equal(db.calls.commit, 2)
  assert.equal(db.calls.rollback, 1)
})

test("YDB does not retry an ambiguous commit or a timeout", async () => {
  for (const status of [400090, 400170, 400050]) {
    class Uncertain extends Error { static status = status }
    const db = connection({ commits: [new Uncertain("outcome unknown")] })
    let attempts = 0
    await assert.rejects(db.ydbTransaction(async (execute) => { attempts++; await execute("UPDATE money"); return 1 }), /outcome unknown/)
    assert.equal(attempts, 1)
    assert.equal(db.calls.commit, 1)
  }
})

test("YDB rolls back an application error without committing", async () => {
  const db = connection()
  await assert.rejects(db.ydbTransaction(async (execute) => { await execute("UPDATE money"); throw new Error("validation failed") }), /validation failed/)
  assert.equal(db.calls.commit, 0)
  assert.equal(db.calls.rollback, 1)
})

test("parallel operations inside a YDB transaction share one sequential session", async () => {
  const db = connection({ queryDelay: 5 })
  await db.ydbTransaction(async (execute) => { await Promise.all([execute("query a"), execute("query b"), execute("query c")]) })
  assert.equal(db.calls.maxActive, 1)
  assert.equal(db.calls.commit, 1)
})
