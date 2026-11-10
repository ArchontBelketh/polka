// Transactional memory fixture: verifies application boundaries and recovery,
// not database isolation or SQL behavior in PostgreSQL/YDB.
import { AsyncLocalStorage } from "node:async_hooks"

export function storeFixture({ serializeWrites = false } = {}) {
  const names = ["user", "developerProfile", "developerListing", "exposureEvent", "jobInvitation", "product", "productFile", "productVersion", "productUpload", "productSubmission", "purchase", "review", "moderationLog", "wishlist", "supportTicket", "payout", "financialOperation", "job", "jobProposal", "jobContract", "jobMessage", "jobAttachment", "jobDelivery", "jobReview", "jobStatusLog", "jobDispute", "jobNotification", "ticketMessage"]
  let state = Object.fromEntries(names.map(name => [name, []])), sequence = 0, tail = Promise.resolve()
  const transactionScope = new AsyncLocalStorage()
  const control = { commitError: false, operations: [], rejectWrite: null, get inTransaction() { return transactionScope.getStore() === true } }
  function matches(row, where = {}, tables = state) {
    return Object.entries(where).every(([key, expected]) => {
      if (expected === undefined) return true
      if (key === "AND") return (Array.isArray(expected) ? expected : [expected]).every(item => matches(row, item, tables))
      if (key === "OR") return expected.some(item => matches(row, item, tables))
      if (key === "NOT") return !(Array.isArray(expected) ? expected : [expected]).some(item => matches(row, item, tables))
      if (["productId_authorId", "jobId_developerId", "jobId_authorId"].includes(key)) return matches(row, expected, tables)
      if (key === "product" && row.productId) return matches(tables.product.find(product => product.id === row.productId) ?? {}, expected, tables)
      if (key === "job" && row.jobId) return matches(tables.job.find(job => job.id === row.jobId) ?? {}, expected, tables)
      if (key === "user" && row.userId) return matches(tables.user.find(user => user.id === row.userId) ?? {}, expected, tables)
      if (key === "developerProfile") return matches(tables.developerProfile.find(profile => profile.userId === row.id) ?? {}, expected, tables)
      if (["customer", "developer", "author", "recipient"].includes(key) && row[`${key}Id`]) return matches(tables.user.find(user => user.id === row[`${key}Id`]) ?? {}, expected, tables)
      const actual = row[key]
      if (expected?.getTime && actual?.getTime) return actual.getTime() === expected.getTime()
      if (expected && typeof expected === "object" && !Array.isArray(expected) && !(expected instanceof Date)) return Object.entries(expected).every(([op, value]) => {
        if (op === "in") return value.includes(actual)
        if (op === "has") return Array.isArray(actual) && actual.includes(value)
        if (op === "not") return value === null ? actual !== null && actual !== undefined : actual !== value
        if (op === "lt") return actual < value
        if (op === "lte") return actual <= value
        if (op === "gt") return actual > value
        if (op === "gte") return actual >= value
        if (op === "mode") return true
        if (op === "contains") return typeof actual === "string" && (expected.mode === "insensitive" ? actual.toLowerCase().includes(value.toLowerCase()) : actual.includes(value))
        if (op === "startsWith") return typeof actual === "string" && actual.startsWith(value)
        throw new Error(`Unsupported fixture predicate ${op}`)
      })
      return expected === null ? actual === null || actual === undefined : actual === expected
    })
  }
  function defaults(name, data) {
    return { id: data.id ?? `test-${++sequence}`, createdAt: new Date(), updatedAt: new Date(),
      ...(name === "user" ? { role: "BUYER", name: null, email: null, telegramHandle: null, telegramId: null, balance: 0, payoutsFrozen: false, isBanned: false } : {}),
      ...(name === "developerListing" ? { enabled: true, listedAt: new Date() } : {}),
      ...(name === "product" ? { status: "DRAFT", publishedAt: null, screenshots: [], rating: 0, reviewCount: 0, salesCount: 0 } : {}),
      ...(name === "productUpload" ? { status: "PENDING", artifactKey: null, completedAt: null, stagingDeletedAt: null } : {}),
      ...(name === "purchase" ? { status: "PENDING", downloadCount: 0, paidAt: null, creditedAt: null, holdUntil: null, payoutId: null, developerAmount: null, paymentId: null } : {}),
      ...(name === "payout" ? { status: "PENDING", receiptSent: false, paidAt: null } : {}),
      ...(name === "financialOperation" ? { status: "PREPARED", appliedAt: null, providerId: null, providerStatus: null } : {}),
      ...(name === "supportTicket" ? { status: "OPEN" } : {}),
      ...(name === "job" ? { publicationStatus: "DRAFT", status: "OPEN", revision: 0, moderationReason: null, cancellationRequestedBy: null, cancellationReason: null, publishedAt: null, completedAt: null } : {}),
      ...(name === "jobProposal" ? { status: "ACTIVE", revision: 1 } : {}),
      ...(name === "jobDelivery" ? { status: "PENDING", attachmentIds: [], customerFeedback: null, reviewedAt: null } : {}),
      ...(name === "jobStatusLog" ? { fromStatus: null, toStatus: null, reason: null, data: null, proposalId: null } : {}),
      ...(name === "jobDispute" ? { resolvedAt: null, resolution: null, resolvedById: null } : {}),
      ...(name === "jobContract" ? { agreedAt: new Date() } : {}), ...data }
  }
  function patch(row, data) {
    for (const [key, value] of Object.entries(data)) row[key] = value && typeof value === "object" && "increment" in value ? (row[key] ?? 0) + value.increment : value && typeof value === "object" && "decrement" in value ? (row[key] ?? 0) - value.decrement : value
    row.updatedAt = new Date()
    return row
  }
  function client(getState) {
    const api = {}
    function ordered(rows, orderBy) {
      const rules = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []
      return [...rows].sort((a, b) => {
        for (const rule of rules) for (const [key, direction] of Object.entries(rule)) {
          if (a[key] < b[key]) return direction === "asc" ? -1 : 1
          if (a[key] > b[key]) return direction === "asc" ? 1 : -1
        }
        return 0
      })
    }
    function shape(name, row, args = {}) {
      if (!row) return null
      const result = args.select ? {} : structuredClone(row)
      for (const [key, selection] of Object.entries(args.select || args.include || {})) {
        if (!selection) continue
        if (key in row) { result[key] = structuredClone(row[key]); continue }
        const relations = {
          user: { developerProfile: ["developerProfile", { userId: row.id }] },
          developerListing: { user: ["user", { id: row.userId }] },
          jobInvitation: { job: ["job", { id: row.jobId }], developer: ["user", { id: row.developerId }] },
          product: { author: ["user", { id: row.authorId }], files: ["productFile", { productId: row.id }], versions: ["productVersion", { productId: row.id }] },
          productUpload: { product: ["product", { id: row.productId }] },
          purchase: { product: ["product", { id: row.productId }], buyer: ["user", { id: row.buyerId }], payout: ["payout", { id: row.payoutId }] },
          payout: { developer: ["user", { id: row.developerId }], purchases: ["purchase", { payoutId: row.id }] },
          review: { author: ["user", { id: row.authorId }] },
          job: { customer: ["user", { id: row.customerId }], contract: ["jobContract", { jobId: row.id }] },
          jobProposal: { developer: ["user", { id: row.developerId }] },
          jobMessage: { sender: ["user", { id: row.senderId }] },
          jobReview: { job: ["job", { id: row.jobId }], author: ["user", { id: row.authorId }] },
          jobContract: { job: ["job", { id: row.jobId }] },
          jobNotification: { user: ["user", { id: row.userId }] },
        }
        const relation = relations[name]?.[key]
        if (!relation) throw new Error(`Unsupported fixture projection ${name}.${key}`)
        const [target, filter] = relation, options = selection === true ? {} : selection
        const rows = ordered(getState()[target].filter(item => matches(item, filter, getState()) && matches(item, options.where, getState())), options.orderBy).slice(0, options.take)
        const values = rows.map(item => shape(target, item, options))
        result[key] = ["files", "versions", "purchases"].includes(key) ? values : values[0] ?? null
      }
      return result
    }
    for (const name of names) {
      const table = () => getState()[name]
      api[name] = {
        async findUnique(args) { return shape(name, table().find(row => matches(row, args.where, getState())), args) },
        async findFirst(args = {}) { return this.findUnique(args) },
        async findMany(args = {}) { const rows = ordered(table().filter(row => matches(row, args.where, getState())), args.orderBy).slice(args.skip ?? 0); return rows.slice(0, args.take).map(row => shape(name, row, args)) },
        async count(args = {}) { return table().filter(row => matches(row, args.where, getState())).length },
        async create({ data, ...args }) {
          control.rejectWrite?.(name, data)
          control.operations.push(`${name}.create`)
          if (data.id && table().some(row => row.id === data.id)) { const error = new Error("duplicate key"); error.code = "P2002"; throw error }
          const row = defaults(name, structuredClone(data)); table().push(row); return shape(name, row, args)
        },
        async updateMany({ where, data }) { control.rejectWrite?.(name, data); control.operations.push(`${name}.updateMany`); const rows = table().filter(row => matches(row, where, getState())); rows.forEach(row => patch(row, data)); return { count: rows.length } },
        async update({ where, data, ...args }) { control.rejectWrite?.(name, data); control.operations.push(`${name}.update`); const row = table().find(row => matches(row, where, getState())); if (!row) throw new Error("missing record"); return shape(name, patch(row, data), args) },
        async deleteMany(args = {}) { const before = table().length; getState()[name] = table().filter(row => !matches(row, args.where)); return { count: before - getState()[name].length } },
        async delete({ where }) { const row = table().find(row => matches(row, where)); await this.deleteMany({ where }); return row },
        async upsert({ where, create, update, ...args }) { const row = table().find(row => matches(row, where)); return row ? this.update({ where: { id: row.id }, data: update, ...args }) : this.create({ data: create, ...args }) },
        async aggregate({ where }) { const rows = table().filter(row => matches(row, where)); return { _avg: { rating: rows.length ? rows.reduce((sum, row) => sum + row.rating, 0) / rows.length : null }, _count: { id: rows.length } } },
      }
    }
    return api
  }
  const db = client(() => state)
  db.$transaction = async fn => {
    let release
    const previous = tail; tail = new Promise(resolve => { release = resolve }); await previous
    const work = structuredClone(state)
    return transactionScope.run(true, async () => {
      try { const result = await fn(client(() => work)); state = work; if (control.commitError) { control.commitError = false; throw new Error("uncertain commit") } return result }
      finally { release() }
    })
  }
  if (serializeWrites) for (const name of names) for (const method of ["create", "update", "updateMany", "delete", "deleteMany", "upsert"]) {
    db[name][method] = args => db.$transaction(tx => tx[name][method](args))
  }
  return { db, control, state: () => state, seed(name, data) { state[name].push(defaults(name, data)) } }
}
