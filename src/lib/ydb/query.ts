import { TypedValues, Types, type Ydb } from "ydb-sdk"
import { modelFor, fieldFor, quote, schema, storageType, indexesFor, type Model, type Field } from "./schema"
import type { Params } from "./connection"

export type RecordValue = Record<string, unknown>
export const object = (value: unknown): value is RecordValue => !!value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)
export const list = <T>(value: T | T[]): T[] => Array.isArray(value) ? value : [value]

function typed(field: Field, value: unknown): Ydb.ITypedValue {
  const type = storageType(field)
  const primitive = ({ Utf8: Types.UTF8, Int32: Types.INT32, Double: Types.DOUBLE, Bool: Types.BOOL, Timestamp: Types.TIMESTAMP, JsonDocument: Types.JSON_DOCUMENT } as Record<string, Ydb.IType>)[type]
  if (value === null) return TypedValues.optionalNull(primitive)
  if (type === "JsonDocument") return TypedValues.jsonDocument(JSON.stringify(value))
  if (type === "Timestamp") return TypedValues.timestamp(value instanceof Date ? value : new Date(value as string))
  return TypedValues.fromNative(primitive, value)
}

export class Query {
  params: Params = {}
  declarations: string[] = []
  aliases = 0
  value(field: Field, value: unknown) {
    const name = `$p${Object.keys(this.params).length}`
    this.params[name] = typed(field, value)
    this.declarations.push(`DECLARE ${name} AS ${storageType(field)}${value === null ? "?" : ""};`)
    return name
  }
  text(text: string) { return `${this.declarations.join("\n")}\n${text}` }
  source(model: Model, where: RecordValue = {}, alias = "t") {
    const filters: RecordValue = { ...where }
    if (where.AND) for (const part of list(where.AND)) if (object(part)) Object.assign(filters, part)
    for (const key of model.unique) {
      const value = filters[key.join("_")]
      if (object(value)) Object.assign(filters, value)
    }
    const useful = (key: string) => filters[key] !== undefined && filters[key] !== null && (!object(filters[key]) || ["equals", "in", "gt", "gte", "lt", "lte"].some((op) => Object.hasOwn(filters[key] as RecordValue, op)))
    const index = !useful(model.primaryKey[0]) && indexesFor(model).find((keys) => useful(keys[0]))
    return `${quote(model.name)}${index ? ` VIEW ${quote(index.join("_") + "_idx")}` : ""} AS ${quote(alias)}`
  }
  condition(model: Model, where: RecordValue = {}, alias = "t"): string {
    const clauses: string[] = []
    for (const [name, value] of Object.entries(where)) {
      if (value === undefined) continue
      if (["AND", "OR", "NOT"].includes(name)) {
        const items = list(value as RecordValue | RecordValue[]).map((v) => this.condition(model, v, alias))
        clauses.push(name === "NOT" ? items.map((v) => `NOT (${v})`).join(" AND ") || "TRUE"
          : items.length ? `(${items.join(name === "OR" ? " OR " : " AND ")})` : name === "OR" ? "FALSE" : "TRUE")
      } else if (model.relations[name]) {
        const rel = model.relations[name], target = modelFor(rel.model), childAlias = `r${++this.aliases}`
        if (rel.from.length !== 1) throw new Error("Composite relation predicates require an explicit query")
        const col = `${quote(alias)}.${quote(rel.from[0])}`
        const predicate = (filter: unknown, negative = false) => {
          if (!object(filter)) throw new Error(`Invalid relation filter: ${name}`)
          return `${col} ${negative ? "NOT IN" : "IN"} (SELECT ${quote(childAlias)}.${quote(rel.to[0])} FROM ${this.source(target, filter, childAlias)} WHERE ${this.condition(target, filter, childAlias)})`
        }
        if (value === null) clauses.push(`${col} IS NULL`)
        else if (object(value)) {
          if (Object.hasOwn(value, "is")) clauses.push(value.is === null ? `${col} IS NULL` : predicate(value.is))
          else if (Object.hasOwn(value, "isNot")) clauses.push(value.isNot === null ? `${col} IS NOT NULL` : `(${col} IS NULL OR ${predicate(value.isNot, true)})`)
          else if (rel.many && Object.hasOwn(value, "some")) clauses.push(predicate(value.some))
          else if (rel.many && Object.hasOwn(value, "none")) clauses.push(predicate(value.none, true))
          else if (rel.many && Object.hasOwn(value, "every")) clauses.push(predicate({ NOT: value.every }, true))
          else clauses.push(predicate(value))
        } else throw new Error(`Invalid relation condition: ${model.name}.${name}`)
      } else if (!model.fields[name] && model.unique.some((key) => key.join("_") === name) && object(value)) {
        clauses.push(this.condition(model, value, alias))
      } else {
        const field = fieldFor(model, name)
        const col = `${quote(alias)}.${quote(name)}`
        clauses.push(this.scalar(col, field, value))
      }
    }
    return clauses.length ? clauses.map((c) => `(${c})`).join(" AND ") : "TRUE"
  }
  scalar(col: string, field: Field, value: unknown): string {
    if (value === null) return `${col} IS NULL`
    if (!object(value)) return `${col} = ${this.value(field, value)}`
    const clauses: string[] = []
    for (const [op, operand] of Object.entries(value)) {
      if (operand === undefined || op === "mode") continue
      if (op === "equals") clauses.push(this.scalar(col, field, operand))
      else if (op === "has") {
        if (!field.list || field.type !== "String" || typeof operand !== "string") throw new Error("has requires a string list and string value")
        // Bind the item separately from the fixed JsonPath. JsonDocument lists
        // use SQL JSON functions: https://ydb.tech/docs/en/yql/reference/builtins/json
        const param = this.value({ ...field, list: false, nullable: false }, operand)
        clauses.push(`COALESCE(JSON_EXISTS(${col}, '$[*] ? (@ == $item)' PASSING ${param} AS item), FALSE)`)
      }
      else if (op === "not") clauses.push(operand === null ? `${col} IS NOT NULL` : `NOT (${this.scalar(col, field, operand)})`)
      else if (["in", "notIn"].includes(op)) {
        if (!Array.isArray(operand)) throw new Error("IN requires a list")
        clauses.push(operand.length ? `${col} ${op === "notIn" ? "NOT IN" : "IN"} (${operand.map((v) => this.value(field, v)).join(", ")})` : op === "in" ? "FALSE" : "TRUE")
      } else if (["gt", "gte", "lt", "lte"].includes(op)) {
        const operator = { gt: ">", gte: ">=", lt: "<", lte: "<=" }[op]!
        clauses.push(`${col} ${operator} ${this.value(field, operand)}`)
      } else if (["contains", "startsWith", "endsWith"].includes(op)) {
        if (field.type !== "String" || typeof operand !== "string") throw new Error("String predicate requires a string field and value")
        const param = this.value(field, operand)
        const lhs = value.mode === "insensitive" ? `Unicode::ToLower(${col})` : col
        const rhs = value.mode === "insensitive" ? `Unicode::ToLower(${param})` : param
        const fn = { contains: "Contains", startsWith: "StartsWith", endsWith: "EndsWith" }[op]
        clauses.push(`String::${fn}(CAST(${lhs} AS String), CAST(${rhs} AS String))`)
      } else throw new Error(`Unsupported YDB filter operation: ${op}`)
    }
    return clauses.length ? clauses.join(" AND ") : "TRUE"
  }
  order(model: Model, orderBy: unknown) {
    if (!orderBy) return ""
    const terms: string[] = []
    for (const order of list(orderBy)) {
      if (!object(order)) throw new Error("Invalid orderBy")
      for (const [name, direction] of Object.entries(order)) {
        const field = fieldFor(model, name)
        if (direction !== "asc" && direction !== "desc") throw new Error("Unsupported sort direction")
        const col = `t.${quote(name)}`, dir = direction.toUpperCase()
        if (field.nullable) terms.push(`(${col} IS NULL) ${dir}`)
        const values = schema.enums[field.type]
        const expr = values ? `CASE ${col} ${values.map((v, i) => `WHEN ${this.value(field, v)} THEN ${i}`).join(" ")} ELSE ${values.length} END` : col
        terms.push(`${expr} ${dir}`)
      }
    }
    return terms.length ? ` ORDER BY ${terms.join(", ")}` : ""
  }
}

export function decode(model: Model, row: RecordValue): RecordValue {
  const result: RecordValue = {}
  for (const [name, raw] of Object.entries(row)) {
    const field = fieldFor(model, name)
    if (raw === null || raw === undefined) result[name] = field.list ? [] : null
    else if (field.type === "DateTime") result[name] = raw instanceof Date ? raw : new Date(raw as string)
    else if (field.type === "Json" || field.list) result[name] = typeof raw === "string" ? JSON.parse(raw) : raw
    else result[name] = raw
  }
  return result
}

export function number(value: unknown) {
  if (value === null || value === undefined) return null
  const result = Number(value)
  if (!Number.isFinite(result) || (Number.isInteger(result) && !Number.isSafeInteger(result))) throw new Error("YDB numeric result exceeds the safe JavaScript range")
  return result
}
