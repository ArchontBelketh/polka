import { createHash } from "node:crypto"
import { createId } from "@paralleldrive/cuid2"
import { Prisma, type PrismaClient } from "../../generated/prisma/client"
import { disconnectYdb, ydbTransaction, type Executor, type Row } from "./connection"
import { Query, decode, number, object, list, type RecordValue } from "./query"
import { schema, quote, modelFor, fieldFor, type Model } from "./schema"
import { assertMigrationsReady } from "./migrations"

type Args = { where?: RecordValue; data?: RecordValue; create?: RecordValue; update?: RecordValue; select?: RecordValue; include?: RecordValue; orderBy?: unknown; take?: number; skip?: number; distinct?: string | string[]; by?: string[]; _count?: unknown; _sum?: RecordValue; _avg?: RecordValue; _min?: RecordValue; _max?: RecordValue }
type Operation = { model: Model; method: string; args: Args }
const stringField = { type: "String", nullable: false, list: false, updatedAt: false }
const methods = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findMany", "count", "aggregate", "groupBy", "create", "update", "updateMany", "delete", "deleteMany", "upsert"])
const readMethods = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findMany", "count", "aggregate", "groupBy"])
const allowedArgs = new Set(["where", "data", "create", "update", "select", "include", "orderBy", "take", "skip", "distinct", "by", "_count", "_sum", "_avg", "_min", "_max"])

function failure(code: string, message: string, meta?: RecordValue): never {
  throw new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: "ydb-native-1", meta })
}
const pk = (model: Model, row: Row): RecordValue => Object.fromEntries(model.primaryKey.map((field) => [field, row[field]]))
const owner = (model: Model, row: Row) => JSON.stringify([model.name, ...model.primaryKey.map((field) => row[field])])

/** A lazy operation keeps $transaction([...]) atomic: creating the operations does
 * not send requests. Execution starts only when awaited or passed to a transaction. */
class Pending implements PromiseLike<unknown> {
  readonly [Symbol.toStringTag] = "PrismaPromise"
  private promise?: Promise<unknown>
  constructor(readonly operation: Operation, readonly run: (operation: Operation) => Promise<unknown>) {}
  then<TResult1 = unknown, TResult2 = never>(ok?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null, fail?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) {
    this.promise ??= this.run(this.operation)
    return this.promise.then(ok, fail)
  }
  catch(fail: (reason: unknown) => unknown) { return this.then(undefined, fail) }
  finally(done: () => void) { this.promise ??= this.run(this.operation); return this.promise.finally(done) }
  get started() { return this.promise !== undefined }
}

class Store {
  constructor(readonly execute: Executor) {}
  async sql(query: Query, text: string): Promise<Row[]> {
    const sets = await this.execute(query.text(text), query.params)
    return sets[0] || []
  }
  async rows(model: Model, args: Args = {}): Promise<Row[]> {
    const q = new Query()
    const condition = q.condition(model, args.where)
    let columns = Object.keys(model.fields)
    let distinct = ""
    if (args.distinct) {
      const keys = list(args.distinct)
      if (!args.select || args.include || Object.entries(args.select).some(([key, value]) => value && !keys.includes(key))) {
        throw new Error("YDB distinct queries must select only the distinct fields")
      }
      keys.forEach((key) => fieldFor(model, key))
      columns = keys
      distinct = "DISTINCT "
    }
    const ordering = args.orderBy ? list(args.orderBy) : []
    const orderedKeys = new Set(ordering.flatMap((order) => object(order) ? Object.keys(order) : []))
    for (const key of args.distinct ? list(args.distinct) : model.primaryKey) if (!orderedKeys.has(key)) ordering.push({ [key]: "asc" })
    const text = `SELECT ${distinct}${columns.map((name) => `t.${quote(name)}`).join(", ")} FROM ${q.source(model, args.where)} WHERE ${condition}${q.order(model, ordering)}`
    for (const [name, value] of [["take", args.take], ["skip", args.skip]] as const) {
      if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw new Error(`Invalid ${name}`)
    }
    const result: Row[] = []
    while (args.take === undefined || result.length < args.take) {
      const limit = Math.min(256, args.take === undefined ? 256 : args.take - result.length)
      const offset = (args.skip || 0) + result.length
      const rows = await this.sql(q, `${text} LIMIT ${limit}${offset ? ` OFFSET ${offset}` : ""};`)
      result.push(...rows.map((row) => decode(model, row)))
      if (rows.length < limit) break
    }
    return result
  }
  async shape(model: Model, row: Row, args: Args): Promise<Row> {
    if (args.select && args.include) throw new Error("Use either select or include")
    const result: Row = args.select ? {} : { ...row }
    for (const [name, selection] of Object.entries(args.select || args.include || {})) {
      if (!selection) continue
      if (model.fields[name]) { result[name] = row[name]; continue }
      if (name === "_count") {
        const selected = selection === true ? Object.fromEntries(Object.keys(model.relations).map((key) => [key, true])) : (selection as { select: RecordValue }).select
        if (!selected) throw new Error("Invalid relation count selection")
        const counts: Row = {}
        for (const [key, filter] of Object.entries(selected)) {
          if (!filter) continue
          const rel = model.relations[key]
          if (!rel) throw new Error(`Unknown relation count: ${model.name}.${key}`)
          const where = Object.fromEntries(rel.to.map((field, i) => [field, row[rel.from[i]]]))
          counts[key] = rel.from.some((field) => row[field] === null) ? 0 : await this.count(modelFor(rel.model), { where: { AND: [where, object(filter) ? filter.where || {} : {}] } })
        }
        result[name] = counts
        continue
      }
      const rel = model.relations[name]
      if (!rel) throw new Error(`Unknown projection ${model.name}.${name}`)
      if (rel.from.some((field) => row[field] === null || row[field] === undefined)) {
        result[name] = rel.many ? [] : null
        continue
      }
      const target = modelFor(rel.model)
      const filter = selection === true ? {} : selection as Args
      const relationWhere = Object.fromEntries(rel.to.map((field, i) => [field, row[rel.from[i]]]))
      const childArgs: Args = { ...filter, where: { AND: [relationWhere, filter.where || {}] }, ...(rel.many ? {} : { take: 1 }) }
      const rows = await this.rows(target, childArgs)
      const shaped = []
      for (const child of rows) shaped.push(await this.shape(target, child, childArgs))
      if (!rel.many && !rel.nullable && !shaped[0]) failure("P2025", `Required relation missing: ${model.name}.${name}`)
      result[name] = rel.many ? shaped : shaped[0] || null
    }
    return result
  }
  async count(model: Model, args: Args) {
    const q = new Query()
    const [row] = await this.sql(q, `SELECT COUNT(*) AS total FROM ${q.source(model, args.where)} WHERE ${q.condition(model, args.where)};`)
    return number(row?.total) || 0
  }
  async aggregate(model: Model, args: Args, grouped: boolean) {
    const q = new Query()
    const groups = grouped ? args.by || [] : []
    groups.forEach((field) => fieldFor(model, field))
    if (grouped && groups.length === 0) throw new Error("groupBy requires fields")
    const columns: string[] = groups.map((field) => `t.${quote(field)}`)
    const mapping: Array<{ alias: string; op: string; field: string }> = []
    for (const op of ["_count", "_sum", "_avg", "_min", "_max"] as const) {
      const choice = args[op]
      if (!choice) continue
      const fields = choice === true ? { _all: true } : choice as RecordValue
      for (const [field, selected] of Object.entries(fields)) {
        if (!selected) continue
        if (field !== "_all") fieldFor(model, field)
        if (field === "_all" && op !== "_count") throw new Error("Only COUNT supports _all")
        const alias = `a${mapping.length}`
        mapping.push({ alias, op, field })
        const fn = op.slice(1).toUpperCase()
        columns.push(`${fn}(${field === "_all" ? "*" : `t.${quote(field)}`}) AS ${quote(alias)}`)
      }
    }
    if (!mapping.length) throw new Error("No aggregate selected")
    const text = `SELECT ${columns.join(", ")} FROM ${q.source(model, args.where)} WHERE ${q.condition(model, args.where)}${groups.length ? ` GROUP BY ${groups.map((f) => `t.${quote(f)}`).join(", ")}` : ""};`
    const rows = await this.sql(q, text)
    const converted = rows.map((row) => {
      const result: Row = Object.fromEntries(groups.map((field) => [field, row[field]]))
      for (const { alias, op, field } of mapping) {
        const value = op === "_count" ? number(row[alias]) || 0 : number(row[alias])
        if (op === "_count" && args._count === true) result._count = value
        else { result[op] ??= {}; (result[op] as Row)[field] = value }
      }
      return result
    })
    return grouped ? converted : converted[0]
  }
  defaults(model: Model, input: RecordValue): Row {
    const row: Row = {}, now = new Date()
    for (const [name, field] of Object.entries(model.fields)) {
      if (input[name] !== undefined) row[name] = input[name]
      else if (field.updatedAt) row[name] = now
      else if (object(field.default) && field.default.fn) row[name] = field.default.fn === "cuid" ? createId() : now
      else if (field.default !== undefined) row[name] = structuredClone(field.default)
      else if (field.nullable) row[name] = null
      else failure("P2012", `Required value missing: ${model.name}.${name}`)
    }
    return row
  }
  validate(model: Model, row: Row) {
    for (const [name, field] of Object.entries(model.fields)) {
      let value = row[name]
      if (value === Prisma.DbNull || value === Prisma.JsonNull) value = row[name] = null
      if (value === null) { if (!field.nullable && !field.list) failure("P2011", `Null value: ${model.name}.${name}`); continue }
      const valid = field.list ? Array.isArray(value) && value.every((item) => typeof item === "string")
        : field.type === "String" || schema.enums[field.type] ? typeof value === "string" && (!schema.enums[field.type] || schema.enums[field.type].includes(value))
        : field.type === "Int" ? typeof value === "number" && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647
        : field.type === "Float" ? typeof value === "number" && Number.isFinite(value)
        : field.type === "Boolean" ? typeof value === "boolean"
        : field.type === "DateTime" ? (value instanceof Date || typeof value === "string") && !Number.isNaN(new Date(value as string).getTime())
        : field.type === "Json" ? value !== undefined && JSON.stringify(value) !== undefined : false
      if (!valid) failure("P2009", `Invalid value: ${model.name}.${name}`)
    }
  }
  async references(model: Model, row: Row) {
    for (const rel of Object.values(model.relations)) {
      if (rel.reverse || rel.from.some((field) => row[field] === null)) continue
      const where = Object.fromEntries(rel.to.map((field, i) => [field, row[rel.from[i]]]))
      if (!(await this.rows(modelFor(rel.model), { where, take: 1 })).length) failure("P2003", `Foreign key violation: ${model.name} -> ${rel.model}`)
    }
  }
  guardKeys(model: Model, row: Row) {
    return model.unique.filter((fields) => fields.every((field) => row[field] !== null && row[field] !== undefined)).map((fields) => {
      const key = createHash("sha256").update(JSON.stringify([model.name, fields, fields.map((field) => row[field])])).digest("hex")
      return { key, fields }
    })
  }
  async guard(model: Model, before: Row | null, after: Row | null) {
    const previous = before ? this.guardKeys(model, before) : []
    const next = after ? this.guardKeys(model, after) : []
    for (const { key, fields } of next) {
      const q = new Query()
      const [existing] = await this.sql(q, `SELECT owner FROM \`_UniqueValue\` WHERE key = ${q.value(stringField, key)};`)
      const identifier = owner(model, after!)
      if (existing && existing.owner !== identifier) failure("P2002", `Unique constraint failed: ${model.name}.${fields.join(",")}`, { target: fields })
      if (!existing) {
        const write = new Query()
        await this.sql(write, `UPSERT INTO \`_UniqueValue\` (key, owner) VALUES (${write.value(stringField, key)}, ${write.value(stringField, identifier)});`)
      }
    }
    for (const { key } of previous) {
      if (next.some((guard) => guard.key === key)) continue
      const q = new Query()
      await this.sql(q, `DELETE FROM \`_UniqueValue\` WHERE key = ${q.value(stringField, key)};`)
    }
  }
  async write(model: Model, row: Row, create: boolean) {
    const q = new Query()
    const fields = Object.keys(model.fields)
    const values = fields.map((name) => q.value(model.fields[name], row[name]))
    await this.sql(q, `${create ? "INSERT" : "UPSERT"} INTO ${quote(model.name)} (${fields.map(quote).join(", ")}) VALUES (${values.join(", ")});`)
  }
  async create(model: Model, args: Args) {
    const data = args.data || {}
    this.checkData(model, data)
    const row = this.defaults(model, data)
    this.validate(model, row)
    if ((await this.rows(model, { where: pk(model, row), take: 1 })).length) failure("P2002", `Primary key exists: ${model.name}`, { target: model.primaryKey })
    await this.references(model, row)
    await this.guard(model, null, row)
    await this.write(model, row, true)
    for (const [name, nested] of Object.entries(data)) {
      const rel = model.relations[name]
      if (!rel || !object(nested)) continue
      if (!rel.reverse || !nested.create || Object.keys(nested).some((key) => key !== "create")) throw new Error(`Unsupported nested write: ${model.name}.${name}`)
      for (const input of list(nested.create)) {
        if (!object(input)) throw new Error("Invalid nested create")
        await this.create(modelFor(rel.model), { data: { ...input, ...Object.fromEntries(rel.to.map((field, i) => [field, row[rel.from[i]]])) } })
      }
    }
    return this.shape(model, row, args)
  }
  checkData(model: Model, data: RecordValue) {
    for (const [name, value] of Object.entries(data)) {
      if (value === undefined) continue
      if (!model.fields[name] && !model.relations[name]) throw new Error(`Unknown write field: ${model.name}.${name}`)
    }
  }
  patch(model: Model, before: Row, data: RecordValue) {
    this.checkData(model, data)
    const row = { ...before }
    for (const [name, value] of Object.entries(data)) {
      if (value === undefined) continue
      const field = fieldFor(model, name)
      if (model.primaryKey.includes(name) && value !== before[name]) throw new Error("Primary keys are immutable during YDB migration")
      if (value !== Prisma.DbNull && value !== Prisma.JsonNull && object(value) && field.type !== "Json" && !field.list) {
        const operations = Object.keys(value)
        if (operations.length !== 1) throw new Error("Invalid atomic field update")
        const op = operations[0], operand = value[op]
        if (op === "set") row[name] = operand
        else if (["increment", "decrement", "multiply", "divide"].includes(op) && typeof before[name] === "number" && typeof operand === "number") {
          row[name] = op === "increment" ? (before[name] as number) + operand : op === "decrement" ? (before[name] as number) - operand : op === "multiply" ? (before[name] as number) * operand : (before[name] as number) / operand
        } else throw new Error(`Unsupported atomic operation: ${op}`)
      } else if (field.list && object(value) && Object.hasOwn(value, "set")) row[name] = value.set
      else if (field.list && object(value) && Object.hasOwn(value, "push")) row[name] = [...before[name] as string[], ...list(value.push)]
      else row[name] = value
    }
    for (const [name, field] of Object.entries(model.fields)) if (field.updatedAt && data[name] === undefined) row[name] = new Date()
    this.validate(model, row)
    return row
  }
  async update(model: Model, args: Args, many: boolean) {
    const rows = await this.rows(model, { where: args.where, ...(many ? {} : { take: 1 }) })
    if (!many && !rows.length) failure("P2025", `Record not found: ${model.name}`)
    let result: Row | undefined
    for (const before of rows) {
      const after = this.patch(model, before, args.data || {})
      await this.references(model, after)
      await this.guard(model, before, after)
      await this.write(model, after, false)
      if (!many) result = await this.shape(model, after, args)
    }
    return many ? { count: rows.length } : result
  }
  async remove(model: Model, args: Args, many: boolean) {
    const rows = await this.rows(model, { where: args.where, ...(many ? {} : { take: 1 }) })
    if (!many && !rows.length) failure("P2025", `Record not found: ${model.name}`)
    const result = !many ? await this.shape(model, rows[0], args) : undefined
    for (const row of rows) {
      for (const target of Object.values(schema.models)) {
        for (const rel of Object.values(target.relations)) {
          if (rel.reverse || rel.model !== model.name) continue
          const where = Object.fromEntries(rel.from.map((field, i) => [field, row[rel.to[i]]]))
          if (rel.onDelete === "Cascade") await this.remove(target, { where }, true)
          else if (rel.onDelete === "SetNull") await this.update(target, { where, data: Object.fromEntries(rel.from.map((field) => [field, null])) }, true)
          else if (await this.count(target, { where })) failure("P2003", `Delete restricted by ${target.name}`)
        }
      }
      await this.guard(model, row, null)
      const q = new Query()
      const condition = model.primaryKey.map((name) => `${quote(name)} = ${q.value(model.fields[name], row[name])}`).join(" AND ")
      await this.sql(q, `DELETE FROM ${quote(model.name)} WHERE ${condition};`)
    }
    return many ? { count: rows.length } : result
  }
  async run({ model, method, args }: Operation): Promise<unknown> {
    for (const name of Object.keys(args)) if (!allowedArgs.has(name)) throw new Error(`Unsupported query option: ${name}`)
    if (method === "count") return this.count(model, args)
    if (method === "aggregate" || method === "groupBy") return this.aggregate(model, args, method === "groupBy")
    if (readMethods.has(method)) {
      const rows = await this.rows(model, { ...args, ...(method !== "findMany" ? { take: 1 } : {}) })
      if (!rows.length && method === "findUniqueOrThrow") failure("P2025", `Record not found: ${model.name}`)
      const result = []
      for (const row of rows) result.push(await this.shape(model, row, args))
      return method === "findMany" ? result : result[0] || null
    }
    if (method === "create") return this.create(model, args)
    if (method === "upsert") {
      const [before] = await this.rows(model, { where: args.where, take: 1 })
      return before ? this.update(model, { ...args, data: args.update, where: pk(model, before) }, false)
        : this.create(model, { ...args, data: args.create })
    }
    if (method === "update" || method === "updateMany") return this.update(model, args, method === "updateMany")
    if (method === "delete" || method === "deleteMany") return this.remove(model, args, method === "deleteMany")
    throw new Error(`Unsupported data operation: ${method}`)
  }
}

/** Native YDB implementation of the operations used by this project. Prisma is
 * retained as the generated type contract and for PostgreSQL export, not as a YDB provider. */
export function createYdbDatabase(): PrismaClient {
  function client(store?: Store): unknown {
    const run = (operation: Operation) => store ? store.run(operation) : ydbTransaction((execute) => new Store(execute).run(operation))
    const delegates: Record<string, unknown> = {}
    for (const model of Object.values(schema.models)) {
      delegates[model.name[0].toLowerCase() + model.name.slice(1)] = Object.fromEntries([...methods].map((method) => [method, (args: Args = {}) => new Pending({ model, method, args }, run)]))
    }
    delegates.$transaction = async (input: Pending[] | ((tx: unknown) => Promise<unknown>)) => {
      if (store) throw new Error("Nested transactions are not supported")
      return ydbTransaction(async (execute) => {
        const tx = new Store(execute)
        if (typeof input === "function") return input(client(tx))
        const result = []
        for (const pending of input) {
          if (!(pending instanceof Pending) || pending.started) throw new Error("Transactions require unstarted operations from this YDB client")
          result.push(await tx.run(pending.operation))
        }
        return result
      })
    }
    delegates.$disconnect = disconnectYdb
    const readiness = async (execute: Executor) => {
      const [rows] = await execute("SELECT id, hash, status FROM `_SchemaMigration`;")
      assertMigrationsReady(rows || [])
      return [{ one: 1 }]
    }
    delegates.$connect = () => ydbTransaction(readiness)
    delegates.$queryRaw = (strings: TemplateStringsArray, ...values: unknown[]) => {
      if (values.length || strings.join("").trim().replace(/;$/, "") !== "SELECT 1") throw new Error("Raw PostgreSQL queries must be migrated explicitly to YQL")
      return store ? readiness(store.execute) : ydbTransaction(readiness)
    }
    return delegates
  }
  return client() as PrismaClient
}
