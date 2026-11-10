import baseline from "./migrations/001_baseline.json"
import developerProfile from "./migrations/002_developer_profile.json"
import productSpecification from "./migrations/003_product_specification.json"
import productUploads from "./migrations/004_product_uploads.json"
import financialOperations from "./migrations/005_financial_operations.json"
import jobMarketplace from "./migrations/006_job_marketplace.json"
import developerDirectory from "./migrations/007_developer_directory.json"
import { schema, indexesFor, type Model } from "./schema"

export interface SchemaMigration {
  id: string
  hash: string
  models: Model[]
}
export interface MigrationRecord { id?: unknown; hash?: unknown; status?: unknown }

// Applied snapshots are immutable. A new model gets its own migration instead
// of changing the hash of the baseline already stored in the user's database.
export const migrations: SchemaMigration[] = [
  { id: "001_baseline", hash: baseline.sourceHash, models: Object.values(baseline.models) as Model[] },
  { id: "002_developer_profile", hash: developerProfile.sourceHash, models: Object.values(developerProfile.models) as Model[] },
  { id: "003_product_specification", hash: productSpecification.sourceHash, models: Object.values(productSpecification.models) as Model[] },
  { id: "004_product_uploads", hash: productUploads.sourceHash, models: Object.values(productUploads.models) as Model[] },
  { id: "005_financial_operations", hash: financialOperations.sourceHash, models: Object.values(financialOperations.models) as Model[] },
  { id: "006_job_marketplace", hash: jobMarketplace.sourceHash, models: Object.values(jobMarketplace.models) as Model[] },
  { id: "007_developer_directory", hash: developerDirectory.sourceHash, models: Object.values(developerDirectory.models) as Model[] },
]

export function assertMigrationSchema() {
  const registered = new Map<string, Model>()
  for (const migration of migrations) for (const model of migration.models) {
    if (registered.has(model.name)) throw new Error(`Duplicate table migration: ${model.name}`)
    registered.set(model.name, model)
  }
  if (registered.size !== Object.keys(schema.models).length) throw new Error("YDB model changes need an explicit migration")
  for (const model of Object.values(schema.models)) {
    const applied = registered.get(model.name)
    const signature = (value: Model) => JSON.stringify([value.fields, value.primaryKey, value.unique, indexesFor(value)])
    if (!applied || signature(applied) !== signature(model)) throw new Error(`YDB model changes need an explicit migration: ${model.name}`)
  }
}

export function pendingMigrations(records: MigrationRecord[], existingTables: Set<string>) {
  const byId = new Map(records.map((record) => [record.id, record]))
  if (byId.size !== records.length) throw new Error("Duplicate YDB migration journal entries")
  for (const record of records) {
    const migration = migrations.find((item) => item.id === record.id)
    if (!migration || migration.hash !== record.hash) throw new Error(`Unknown or changed YDB migration: ${String(record.id)}`)
    if (record.status !== "APPLIED" && record.status !== "APPLYING") throw new Error(`Invalid YDB migration status: ${migration.id}`)
  }
  let pending = false
  for (const migration of migrations) {
    const record = byId.get(migration.id)
    if (record?.status === "APPLIED") {
      if (pending) throw new Error("YDB migrations are applied out of order")
      for (const model of migration.models) if (!existingTables.has(model.name)) throw new Error(`Applied YDB table is missing: ${model.name}`)
    } else {
      if (record && pending) throw new Error("YDB migrations are recorded out of order")
      pending = true
      if (!record && migration.models.some((model) => existingTables.has(model.name))) throw new Error(`YDB tables exist without a migration journal entry: ${migration.id}`)
    }
  }
  return migrations.filter((migration) => byId.get(migration.id)?.status !== "APPLIED")
}

export function assertMigrationsReady(records: MigrationRecord[]) {
  assertMigrationSchema()
  for (const migration of migrations) {
    if (!records.some((record) => record.id === migration.id && record.hash === migration.hash && record.status === "APPLIED")) {
      throw new Error(`YDB schema migration is not ready: ${migration.id}`)
    }
  }
}
