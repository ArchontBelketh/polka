import "./env"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { TypedValues } from "ydb-sdk"
import { disconnectYdb, getYdbDriver, ydbQuery, ydbTransaction } from "../../src/lib/ydb/connection"
import { createYdbDatabase } from "../../src/lib/ydb/database"
import { migrations, pendingMigrations } from "../../src/lib/ydb/migrations"
import { indexesFor } from "../../src/lib/ydb/schema"

// This deliberately does not apply migrations, select DB_PROVIDER, import user
// data or invoke business handlers. Optional writes use only two random keys in
// the existing diagnostic table, followed by exact-key cleanup and verification.
const probeTable = "CyberPolkaConnectionProbe"
const probeId = `verify-${randomUUID()}`, rollbackId = `${probeId}-rollback`
const idParams = { $id: TypedValues.utf8(probeId) }
const bothParams = { ...idParams, $rollbackId: TypedValues.utf8(rollbackId) }
const declarations = "DECLARE $id AS Utf8; DECLARE $rollbackId AS Utf8;"
const results: { check: string; ms: number }[] = []
let writesAttempted = false
async function check(name: string, work: () => Promise<void>) {
  const start = Date.now(); await work()
  const result = { check: name, ms: Date.now() - start }; results.push(result)
  console.log(JSON.stringify({ passed: true, ...result }))
}
async function value() {
  return (await ydbQuery(`DECLARE $id AS Utf8; SELECT value FROM \`${probeTable}\` WHERE id = $id;`, idParams))[0]?.[0]?.value
}
async function main() {
  const args = process.argv.slice(2)
  if (args.includes("--help")) {
    console.log("Usage: npx tsx scripts/ydb/verify.ts [--write-probe]. Default: read-only SQL/schema/adapter checks. Optional writes touch only random keys in CyberPolkaConnectionProbe, then clean up those exact keys. No migrations, data import or provider switch.")
    return
  }
  if (args.some(arg => arg !== "--write-probe")) throw new Error("Unknown argument. Use --help.")
  const driver = await getYdbDriver()
  await check("constant SQL", async () => {
    assert.equal(Number((await ydbQuery("SELECT 1 AS connection_ok;"))[0]?.[0]?.connection_ok), 1)
  })
  await check("SQL reads the previously failing diagnostic table", async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const rows = (await ydbQuery(`SELECT COUNT(*) AS probe_count FROM \`${probeTable}\`;`))[0]
      assert.ok(Number.isSafeInteger(Number(rows?.[0]?.probe_count)))
    }
  })
  await check("migration journal and existing baseline tables", async () => {
    const directory = await driver.schemeClient.listDirectory("")
    const names = new Set(directory.children.flatMap(entry => entry.name ? [entry.name] : []))
    const records = (await ydbQuery("SELECT id, hash, status FROM `_SchemaMigration`;"))[0] || []
    const pending = pendingMigrations(records, names)
    assert.ok(names.has("_UniqueValue"))
    console.log(JSON.stringify({ applied: records.filter(row => row.status === "APPLIED").map(row => row.id), pending: pending.map(row => row.id), existingApplicationTables: migrations.flatMap(migration => migration.models).filter(model => names.has(model.name)).length }))
  })
  await check("User/Product/Purchase schema and index descriptions", async () => {
    for (const name of ["User", "Product", "Purchase"]) {
      const model = migrations[0].models.find(model => model.name === name)!
      const table = await driver.tableClient.withSession(session => session.describeTable(name))
      assert.deepEqual(table.columns?.map(column => column.name).sort(), Object.keys(model.fields).sort())
      assert.deepEqual(table.primaryKey, model.primaryKey)
      for (const fields of indexesFor(model)) assert.ok(table.indexes?.some(index => index.name === `${fields.join("_")}_idx` && JSON.stringify(index.indexColumns) === JSON.stringify(fields)), `${name}: index missing`)
    }
  })
  const db = createYdbDatabase()
  await check("native adapter primary-key read and transaction commit", async () => {
    assert.equal(await db.user.findUnique({ where: { id: probeId }, select: { id: true } }), null)
  })
  await check("native adapter indexed email lookup", async () => {
    assert.equal(await db.user.findUnique({ where: { email: `${probeId}@example.invalid` }, select: { id: true } }), null)
  })
  await check("native adapter array filter, status and pagination", async () => {
    assert.deepEqual(await db.product.findMany({ where: { status: "APPROVED", techStack: { has: probeId } }, orderBy: { createdAt: "desc" }, take: 2, select: { id: true } }), [])
  })
  await check("native adapter purchase index and aggregation", async () => {
    assert.equal(await db.purchase.count({ where: { buyerId: probeId } }), 0)
  })
  if (!args.includes("--write-probe")) { console.log(JSON.stringify({ checksPassed: results.length, mode: "read-only" })); return }

  const table = await driver.tableClient.withSession(session => session.describeTable(probeTable))
  assert.deepEqual(table.primaryKey, ["id"])
  assert.deepEqual(table.columns?.map(column => column.name).sort(), ["id", "value"])
  assert.equal(await value(), undefined, "Random probe key unexpectedly exists; refusing to write")
  writesAttempted = true
  await check("diagnostic INSERT, commit and parameterized read", async () => {
    await ydbQuery(`DECLARE $id AS Utf8; INSERT INTO \`${probeTable}\` (id, value) VALUES ($id, "0");`, idParams)
    assert.equal(await value(), "0")
  })
  await check("rollback restores an update and removes an uncommitted insert", async () => {
    const rollback = new Error("intentional-probe-rollback")
    await assert.rejects(ydbTransaction(async execute => {
      await execute(`DECLARE $id AS Utf8; UPDATE \`${probeTable}\` SET value = "100" WHERE id = $id;`, idParams)
      await execute(`DECLARE $rollbackId AS Utf8; INSERT INTO \`${probeTable}\` (id, value) VALUES ($rollbackId, "temporary");`, { $rollbackId: bothParams.$rollbackId })
      throw rollback
    }), error => error === rollback)
    assert.equal(await value(), "0")
    assert.equal(Number((await ydbQuery(`DECLARE $rollbackId AS Utf8; SELECT COUNT(*) AS n FROM \`${probeTable}\` WHERE id = $rollbackId;`, { $rollbackId: bothParams.$rollbackId }))[0]?.[0]?.n), 0)
  })
  await check("two concurrent serializable increments preserve both updates", async () => {
    await Promise.all([0, 1].map(() => ydbTransaction(async execute => {
      const current = (await execute(`DECLARE $id AS Utf8; SELECT value FROM \`${probeTable}\` WHERE id = $id;`, idParams))[0]?.[0]?.value
      assert.ok(current === "0" || current === "1")
      await execute(`DECLARE $id AS Utf8; DECLARE $next AS Utf8; UPDATE \`${probeTable}\` SET value = $next WHERE id = $id;`, { ...idParams, $next: TypedValues.utf8(String(Number(current) + 1)) })
    })))
    assert.equal(await value(), "2")
  })
  console.log(JSON.stringify({ checksPassed: results.length, mode: "diagnostic-write", probeId }))
}
main().catch(error => {
  console.error(JSON.stringify({ failed: true, afterChecks: results.length, message: error instanceof Error ? error.message.slice(0, 1200) : "Unknown verification error" }))
  process.exitCode = 1
}).finally(async () => {
  try {
    if (writesAttempted) {
      await ydbQuery(`${declarations} DELETE FROM \`${probeTable}\` WHERE id IN ($id, $rollbackId);`, bothParams)
      const remaining = Number((await ydbQuery(`${declarations} SELECT COUNT(*) AS n FROM \`${probeTable}\` WHERE id IN ($id, $rollbackId);`, bothParams))[0]?.[0]?.n)
      assert.equal(remaining, 0)
      console.log(JSON.stringify({ diagnosticCleanup: "verified", remaining }))
    }
  } catch { console.error(JSON.stringify({ diagnosticCleanup: "failed", exactIds: [probeId, rollbackId] })); process.exitCode = 1 }
  finally { await disconnectYdb() }
})
