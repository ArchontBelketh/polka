import test from "node:test"
import assert from "node:assert/strict"
import { loadModule } from "./helpers/load-module.mjs"

const params = { params: Promise.resolve({ id: "job", attachmentId: "attachment" }) }
const json = body => new Request("http://localhost/api/orders/job", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
function mocks(actor = null, db = {}) {
  return { "@/lib/current-user": { getCurrentUser: async () => actor }, "@/lib/db": { db }, "@/lib/ratelimit": { rateLimit: () => true }, "@/lib/notify": { notifyJobEvent: async () => {} } }
}

test("all private order APIs reject a guest before touching any order or file", async () => {
  for (const [file, method] of [["src/app/api/orders/route.ts", "POST"], ["src/app/api/orders/[id]/route.ts", "POST"], ["src/app/api/orders/[id]/proposals/route.ts", "GET"], ["src/app/api/orders/[id]/proposals/route.ts", "POST"], ["src/app/api/orders/[id]/workspace/route.ts", "GET"], ["src/app/api/orders/[id]/attachments/route.ts", "POST"], ["src/app/api/orders/[id]/attachments/[attachmentId]/route.ts", "GET"]]) {
    const route = loadModule(file, { mocks: mocks() })
    assert.equal((await route[method](json({}), params)).status, 401, file)
  }
})

test("job API rejects role/owner injection, malformed JSON and oversized text bodies", async () => {
  let writes = 0
  const route = loadModule("src/app/api/orders/[id]/route.ts", { mocks: { ...mocks({ id: "customer", role: "BUYER" }), "@/lib/jobs/service": { runJobCommand: async () => { writes++; return {} } } } })
  for (const body of [{ action: "START", role: "ADMIN" }, { action: "MESSAGE", id: "invalid", text: "test" }, { action: "EDIT", revision: 0, customerId: "foreign", fields: {} }]) assert.equal((await route.POST(json(body), params)).status, 422)
  const huge = json({ action: "MESSAGE", id: "invalid", text: "x".repeat(70000) })
  assert.equal((await route.POST(huge, params)).status, 413)
  assert.equal((await route.POST(new Request("http://localhost/", { method: "POST", body: "{" }), params)).status, 422)
  assert.equal(writes, 0)
})

test("public listing uses only new Job data and an explicit projection without private fields", async () => {
  let queries = 0
  const db = { job: {
    findMany: async args => { queries++; assert.equal(args.where.publicationStatus, "APPROVED"); assert.equal(args.where.customer.isBanned, false); assert.equal(args.select.customer.select.name, true); assert.equal(args.select.customer.select.email, undefined); assert.equal(args.select.moderationReason, undefined); assert.equal(args.select.submissionHash, undefined); return [] },
    count: async () => 0,
  } }
  const route = loadModule("src/app/api/orders/route.ts", { mocks: mocks(null, db) })
  assert.equal((await route.GET(new Request("http://localhost/api/orders?minBudget=200&maxBudget=100"))).status, 400)
  assert.equal(queries, 0)
  assert.equal((await route.GET(new Request("http://localhost/api/orders?q=example"))).status, 200)
  assert.equal(queries, 1)
})

test("private draft metadata stays generic and queries only approved public jobs", async () => {
  const page = loadModule("src/app/orders/[id]/page.tsx", { mocks: {
    ...mocks(), "@/lib/db": { db: { job: { findFirst: async args => { assert.equal(args.where.publicationStatus, "APPROVED"); assert.equal(args.where.customer.isBanned, false); return null } } } },
    "next/link": { __esModule: true, default: () => null }, "next/navigation": {},
    "@/components/jobs/JobManagement": {}, "@/components/jobs/Proposals": {}, "@/app/sell/BecomeDeveloperButton": {}, "@/components/ui/button": {},
  } })
  const result = await page.generateMetadata(params)
  assert.equal(result.title, "Заказ")
  assert.equal(result.robots.index, false)
})

test("job field validation preserves cents, rejects contact details and cannot accept staff fields", () => {
  const policy = loadModule("src/lib/jobs/policy.ts")
  const input = { title: "Автоматизация обработки данных", description: "Необходимо обработать строки таблицы и подготовить файл результата с проверкой ошибок.", outcome: "Отчёт и воспроизводимая инструкция проверки", specialization: "ONE_C", budgetMin: 10029, budgetMax: 19999, deadline: new Date(Date.now() + 86400000).toISOString() }
  assert.equal(policy.jobFields.parse(input).budgetMin, 10029)
  assert.equal(policy.jobFields.safeParse({ ...input, title: "Напишите person@example.invalid" }).success, false)
  assert.equal(policy.jobFields.safeParse({ ...input, budgetMax: 1 }).success, false)
  assert.equal(policy.jobFields.safeParse({ ...input, publicationStatus: "APPROVED" }).success, false)
})

test("job query filters combine budget overlap, dates and specialization without accepting duplicates", () => {
  const { parseJobQuery, jobCatalogWhere } = loadModule("src/lib/jobs/query.ts")
  const parsed = parseJobQuery(new URLSearchParams("q=report&specialization=SCRIPTS&minBudget=100%2C29&maxBudget=200&deadlineBefore=2026-12-31"))
  assert.equal(parsed.success, true)
  const where = jobCatalogWhere(parsed.value)
  assert.equal(where.budgetMax.gte, 10029)
  assert.equal(where.budgetMin.lte, 20000)
  assert.equal(where.specialization, "SCRIPTS")
  assert.ok(where.deadline.gt)
  assert.equal(where.deadline.lte.toISOString(), "2026-12-31T23:59:59.999Z")
  assert.equal(parseJobQuery(new URLSearchParams("status=OPEN&status=ALL")).success, false)
  assert.equal(parseJobQuery(new URLSearchParams("page=0")).success, false)
})

test("named YDB relations distinguish customer/executor and review author/recipient", () => {
  const { modelFor } = loadModule("src/lib/ydb/schema.ts")
  const user = modelFor("User")
  assert.equal(user.relations.customerContracts.to[0], "customerId")
  assert.equal(user.relations.developerContracts.to[0], "developerId")
  assert.equal(user.relations.writtenJobReviews.to[0], "authorId")
  assert.equal(user.relations.receivedJobReviews.to[0], "recipientId")
  assert.equal(modelFor("JobContract").relations.customer.to[0], "id")
})
