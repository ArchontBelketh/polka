import metadata from "./schema.json"

export interface Field {
  type: string
  nullable: boolean
  list: boolean
  updatedAt: boolean
  default?: unknown
}
export interface Relation {
  relationName?: string
  model: string
  many: boolean
  nullable: boolean
  from: string[]
  to: string[]
  reverse?: boolean
  onDelete: string
}
export interface Model {
  name: string
  fields: Record<string, Field>
  relations: Record<string, Relation>
  primaryKey: string[]
  unique: string[][]
  indexes: string[][]
}
export const schema = metadata as { sourceHash: string; enums: Record<string, string[]>; models: Record<string, Model> }
export function modelFor(name: string): Model {
  const model = schema.models[name]
  if (!model) throw new Error(`Unknown data model: ${name}`)
  return model
}
export function quote(name: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error("Invalid database identifier")
  return `\`${name}\``
}
export function fieldFor(model: Model, name: string) {
  const field = model.fields[name]
  if (!field) throw new Error(`Unknown field ${model.name}.${name}`)
  return field
}
export function storageType(field: Field) {
  if (field.list || field.type === "Json") return "JsonDocument"
  return ({ String: "Utf8", Int: "Int32", Float: "Double", Boolean: "Bool", DateTime: "Timestamp" } as Record<string, string>)[field.type] || "Utf8"
}
export const uniqueTableDDL = "CREATE TABLE IF NOT EXISTS `_UniqueValue` (`key` Utf8 NOT NULL, `owner` Utf8, PRIMARY KEY (`key`));"
export const migrationTableDDL = "CREATE TABLE IF NOT EXISTS `_SchemaMigration` (`id` Utf8 NOT NULL, `hash` Utf8, `status` Utf8, `appliedAt` Timestamp, PRIMARY KEY (`id`));"
export function indexesFor(model: Model) {
  return [...model.unique, ...model.indexes].filter((fields) => !fields.every((field) => model.primaryKey.includes(field)))
}
export function tableDDL(model: Model) {
  const columns = Object.entries(model.fields).map(([name, field]) => `${quote(name)} ${storageType(field)}${model.primaryKey.includes(name) ? " NOT NULL" : ""}`)
  const keys = indexesFor(model)
  const indexes = keys.map((fields) => `INDEX ${quote(fields.join("_") + "_idx")} GLOBAL SYNC ON (${fields.map(quote).join(", ")})`)
  return `CREATE TABLE IF NOT EXISTS ${quote(model.name)} (\n  ${[...columns, `PRIMARY KEY (${model.primaryKey.map(quote).join(", ")})`, ...indexes].join(",\n  ")}\n);`
}
