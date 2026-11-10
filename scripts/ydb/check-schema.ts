import { spawnSync } from "node:child_process"
import { assertMigrationSchema, migrations } from "../../src/lib/ydb/migrations"

const result = spawnSync(process.execPath, ["scripts/generate-ydb-schema.mjs", "--check"], { stdio: "inherit" })
if (result.status !== 0) process.exit(result.status ?? 1)
assertMigrationSchema()
console.log(`YDB immutable migration snapshots match: ${migrations.map((migration) => migration.id).join(", ")}.`)
