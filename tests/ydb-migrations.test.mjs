import test from "node:test"
import assert from "node:assert/strict"
import { loadModule } from "./helpers/load-module.mjs"

const { migrations, assertMigrationSchema, pendingMigrations, assertMigrationsReady } = loadModule("src/lib/ydb/migrations.ts")
const applied = (index, status = "APPLIED") => ({ id: migrations[index].id, hash: migrations[index].hash, status })
const baselineTables = () => new Set(migrations[0].models.map((model) => model.name))
const allTables = () => new Set(migrations.flatMap((migration) => migration.models.map((model) => model.name)))

test("the deployed 33-table YDB baseline keeps its original hash", () => {
  assert.equal(migrations[0].hash, "cb40ad7984e6760b90488987651e62bd395c7f315c42038bf34f87ef88f662d3")
  assert.equal(migrations[0].models.length, 33)
  assert.doesNotThrow(assertMigrationSchema)
  const pending = pendingMigrations([applied(0)], baselineTables())
  assert.deepEqual(Array.from(pending, (migration) => migration.id), Array.from(migrations.slice(1), (migration) => migration.id))
  assert.deepEqual(Array.from(pending[0].models, (model) => model.name), ["DeveloperProfile"])
})

test("clean installation and interrupted application resume in migration order", () => {
  assert.equal(pendingMigrations([], new Set()).length, migrations.length)
  const partial = new Set([migrations[0].models[0].name])
  assert.equal(pendingMigrations([applied(0, "APPLYING")], partial).length, migrations.length)
  const firstTwoTables = new Set(migrations.slice(0, 2).flatMap((migration) => migration.models.map((model) => model.name)))
  assert.equal(pendingMigrations([applied(0), applied(1, "APPLYING")], firstTwoTables).length, migrations.length - 1)
  assert.equal(pendingMigrations(migrations.map((_, index) => applied(index)), allTables()).length, 0)
})

test("migration preflight refuses changed hashes, unjournaled tables and missing applied tables", () => {
  assert.throws(() => pendingMigrations([{ ...applied(0), hash: "changed" }], baselineTables()), /changed/)
  assert.throws(() => pendingMigrations([], baselineTables()), /without a migration/)
  assert.throws(() => pendingMigrations([applied(0)], allTables()), /without a migration/)
  assert.throws(() => pendingMigrations([applied(0)], new Set()), /missing/)
  assert.throws(() => pendingMigrations([applied(1)], allTables()), /without a migration|out of order/)
})

test("readiness requires the new profile migration as well as the original baseline", () => {
  assert.throws(() => assertMigrationsReady([applied(0)]), /002_developer_profile/)
  assert.throws(() => assertMigrationsReady([applied(0), applied(1, "APPLYING")]), /002_developer_profile/)
  assert.throws(() => assertMigrationsReady([applied(0), applied(1)]), /003_product_specification/)
  assert.throws(() => assertMigrationsReady([applied(0), applied(1), applied(2)]), /004_product_uploads/)
  assert.throws(() => assertMigrationsReady([applied(0), applied(1), applied(2), applied(3)]), /005_financial_operations/)
  assert.throws(() => assertMigrationsReady([applied(0), applied(1), applied(2), applied(3), applied(4)]), /006_job_marketplace/)
  assert.throws(() => assertMigrationsReady(migrations.slice(0, 6).map((_, index) => applied(index))), /007_developer_directory/)
  assert.doesNotThrow(() => assertMigrationsReady(migrations.map((_, index) => applied(index))))
})

test("the product specification migration adds a table without rewriting earlier snapshots", () => {
  assert.equal(migrations[1].hash, "6a8b8c43a6514a6ec46f3690b3cdc481023df071c58d75d65f355ef8ad84945a")
  assert.deepEqual(Array.from(migrations[2].models, (model) => model.name), ["ProductSpecification"])
  const firstTwoTables = new Set(migrations.slice(0, 2).flatMap((migration) => migration.models.map((model) => model.name)))
  assert.deepEqual(Array.from(pendingMigrations([applied(0), applied(1)], firstTwoTables), (migration) => migration.id), Array.from(migrations.slice(2), (migration) => migration.id))
})
