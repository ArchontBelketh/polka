import "./env"
import { TypedValues, Types, TypedData, TableDescription, TableIndex, Column, Ydb } from "ydb-sdk"
import { disconnectYdb, getYdbDriver, type Row } from "../../src/lib/ydb/connection"
import { schema, storageType, indexesFor, type Model } from "../../src/lib/ydb/schema"
import { assertMigrationSchema, pendingMigrations, type SchemaMigration } from "../../src/lib/ydb/migrations"

const typeMap: Record<string, Ydb.IType> = { Utf8: Types.UTF8, Int32: Types.INT32, Double: Types.DOUBLE, Bool: Types.BOOL, Timestamp: Types.TIMESTAMP, JsonDocument: Types.JSON_DOCUMENT }
function description(model: Model) {
  const columns = Object.entries(model.fields).map(([name, field]) => {
    const base = typeMap[storageType(field)]
    return new Column(name, model.primaryKey.includes(name) ? base : Types.optional(base))
  })
  return new TableDescription(columns, model.primaryKey).withIndexes(...indexesFor(model).map((fields) => new TableIndex(fields.join("_") + "_idx").withIndexColumns(...fields).withGlobalAsync(false)))
}
const pause = () => new Promise((resolve) => setTimeout(resolve, 2200))

async function main() {
  assertMigrationSchema()
  const driver = await getYdbDriver()
  console.log("Connected to YDB through the native SDK.")
  const existing = await driver.schemeClient.listDirectory("")
  const names = new Set(existing.children.flatMap((entry) => typeof entry.name === "string" ? [entry.name] : []))
  const records: Row[] = []
  if (names.has("_SchemaMigration")) await driver.tableClient.withSession((session) => session.streamReadTable("_SchemaMigration", (result) => {
    if (result.resultSet) records.push(...TypedData.createNativeObjects(result.resultSet))
  }))
  // All journal and schema checks precede writes. Applied tables may never be
  // silently recreated, adopted, dropped or changed by a later migration.
  const pending = pendingMigrations(records, names)
  if (records.some((record) => record.id === "001_baseline" && record.status === "APPLIED") && !names.has("_UniqueValue")) throw new Error("Applied unique-constraint table is missing")
  for (const model of Object.values(schema.models)) {
    if (!names.has(model.name)) continue
    await driver.tableClient.withSession(async (session) => {
      const table = await session.describeTable(model.name)
      const actual = table.columns?.map((col) => col.name).sort()
      const expected = Object.keys(model.fields).sort()
      if (JSON.stringify(actual) !== JSON.stringify(expected) || JSON.stringify(table.primaryKey) !== JSON.stringify(model.primaryKey)) throw new Error(`Existing ${model.name} table differs from its migration`)
      for (const col of table.columns || []) {
        const field = model.fields[col.name!]
        const typeId = col.type?.optionalType?.item?.typeId ?? col.type?.typeId
        const expectedType = typeMap[storageType(field)]
        const isOptional = !!col.type?.optionalType
        if (expectedType.typeId !== typeId || isOptional === model.primaryKey.includes(col.name!)) throw new Error(`Existing type differs: ${model.name}.${col.name}`)
      }
      const indexes = indexesFor(model).map((fields) => ({ name: fields.join("_") + "_idx", columns: fields }))
      for (const expected of indexes) if (!table.indexes?.some((index) => index.name === expected.name && JSON.stringify(index.indexColumns) === JSON.stringify(expected.columns))) throw new Error(`Existing index differs: ${model.name}.${expected.name}`)
    })
    await pause()
  }
  if (!pending.length) { console.log("All YDB migrations are already applied and verified."); return }

  if (!names.has("_SchemaMigration")) {
    await driver.tableClient.withSession((session) => session.createTable("_SchemaMigration", new TableDescription([
      new Column("id", Types.UTF8), new Column("hash", Types.optional(Types.UTF8)), new Column("status", Types.optional(Types.UTF8)), new Column("appliedAt", Types.optional(Types.TIMESTAMP)),
    ], ["id"])))
    await pause()
  }
  async function journal(migration: SchemaMigration, status: string) {
    const rows = TypedValues.list(Types.struct({ id: Types.UTF8, hash: Types.UTF8, status: Types.UTF8, appliedAt: Types.TIMESTAMP }), [
      { id: migration.id, hash: migration.hash, status, appliedAt: new Date() },
    ])
    await driver.tableClient.withSession((session) => session.bulkUpsert("_SchemaMigration", Ydb.TypedValue.create(rows)))
  }
  for (const migration of pending) {
    await journal(migration, "APPLYING")
    if (migration.id === "001_baseline" && !names.has("_UniqueValue")) {
      await driver.tableClient.withSession((session) => session.createTable("_UniqueValue", new TableDescription([
        new Column("key", Types.UTF8), new Column("owner", Types.optional(Types.UTF8)),
      ], ["key"])))
      await pause()
    }
    for (const model of migration.models) {
      if (!names.has(model.name)) {
        await driver.tableClient.withSession((session) => session.createTable(model.name, description(model)))
        names.add(model.name)
        console.log(`Created ${model.name}`)
        await pause()
      }
    }
    await journal(migration, "APPLIED")
    console.log(`Applied ${migration.id}`)
  }
  console.log(`YDB schema ready: ${Object.keys(schema.models).length} application tables.`)
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "YDB migration failed"); process.exitCode = 1 }).finally(disconnectYdb)
