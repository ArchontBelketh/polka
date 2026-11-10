import test from "node:test"
import assert from "node:assert/strict"
import { loadModule } from "./helpers/load-module.mjs"
import { storeFixture } from "./helpers/store-fixture.mjs"

const env = { EXPOSURE_METRICS_ENABLED: "true", AUTH_SECRET: "isolated-test-signatures-only" }
const profile = extra => ({ headline: "Автоматизация и разработка ботов", skills: ["TypeScript", "Python"], specializations: ["BOTS", "SCRIPTS"], availability: "AVAILABLE", portfolio: [], ...extra })
function fixture() {
  const f = storeFixture({ serializeWrites: true }), mocks = { "@/lib/db": { db: f.db }, "@/lib/current-user": { getCurrentUser: async () => null }, "@/lib/ratelimit": { rateLimit: () => true }, "@/lib/notify": { notifyJobEvent: async () => {} } }
  f.seed("user", { id: "owner", role: "BUYER", name: "Заказчик" })
  f.seed("user", { id: "mod", role: "MODERATOR" })
  const load = file => loadModule(file, { mocks, env })
  return { ...f, mocks, load, ...load("src/lib/developers/profile.ts"), ...load("src/lib/developers/directory.ts"), ...load("src/lib/developers/invitations.ts"), ...load("src/lib/developers/metrics.ts"), ...load("src/lib/jobs/service.ts") }
}
async function developer(f, id = "dev", extra = {}) {
  f.seed("user", { id, role: "DEVELOPER", name: id, email: "private@example.invalid", passwordHash: "private", balance: 123, pro: true, ...extra })
  await f.saveDeveloperProfile(id, profile({ listed: true }))
}
function openJob(f, id = "job", extra = {}) {
  f.seed("job", { id, customerId: "owner", publicationStatus: "APPROVED", title: "Автоматизация рабочего отчёта", specialization: "SCRIPTS", description: "Условия для тестовой задачи", outcome: "Готовый результат", budgetMin: 10000, budgetMax: 20000, deadline: new Date(Date.now() + 7 * 86400000), ...extra })
}
const query = extra => ({ q: "", skill: "", availability: "READY", page: 1, ...extra })

test("listing is opt-in, remains separate from existing profiles, and cannot be enabled incomplete", async () => {
  const f = fixture(); f.seed("user", { id: "dev", role: "DEVELOPER" })
  await f.saveDeveloperProfile("dev", profile())
  assert.equal(f.state().developerListing.length, 0)
  await assert.rejects(() => f.saveDeveloperProfile("dev", profile({ listed: true, skills: [] })), /заполните/)
  assert.equal(f.state().developerListing.length, 0)
  await f.saveDeveloperProfile("dev", profile({ listed: true }))
  const key = f.state().developerListing[0].sortKey
  await f.saveDeveloperProfile("dev", profile({ listed: false }))
  assert.equal(f.state().developerListing[0].enabled, false)
  await f.saveDeveloperProfile("dev", profile({ listed: true }))
  assert.equal(f.state().developerListing[0].sortKey, key)
})

test("clearing competence disables listing and current bans/roles override a stale profile form", async () => {
  const f = fixture(); await developer(f)
  await f.saveDeveloperProfile("dev", profile({ skills: [] }))
  assert.equal(f.state().developerListing[0].enabled, false)
  for (const changes of [{ isBanned: true }, { isBanned: false, role: "BUYER" }]) {
    await f.db.user.update({ where: { id: "dev" }, data: changes })
    await assert.rejects(() => f.saveDeveloperProfile("dev", profile({ listed: true })), /недоступен/)
  }
})

test("profile and listing writes roll back together", async () => {
  const f = fixture(); f.seed("user", { id: "dev", role: "DEVELOPER" })
  f.control.rejectWrite = name => { if (name === "developerListing") throw new Error("listing unavailable") }
  await assert.rejects(() => f.saveDeveloperProfile("dev", profile({ listed: true })), /unavailable/)
  assert.equal(f.state().developerProfile.length, 0)
})

test("directory filters only public opted-in accounts with competence and availability", async () => {
  const f = fixture(); await developer(f); await developer(f, "busy"); await developer(f, "hidden"); await developer(f, "banned"); await developer(f, "demoted")
  await f.saveDeveloperProfile("busy", profile({ availability: "UNAVAILABLE" }))
  await f.saveDeveloperProfile("hidden", profile({ listed: false }))
  await f.db.user.update({ where: { id: "banned" }, data: { isBanned: true } })
  await f.db.user.update({ where: { id: "demoted" }, data: { role: "BUYER" } })
  const result = await f.readDeveloperDirectory(query({ skill: "Python", specialization: "SCRIPTS", q: "ботов" }))
  assert.deepEqual(Array.from(result.items, item => item.id), ["dev"])
  assert.equal((await f.readDeveloperDirectory(query({ skill: "python" }))).total, 0)
  assert.equal((await f.readDeveloperDirectory(query({ availability: "ALL" }))).total, 2)
  assert.doesNotMatch(JSON.stringify(result), /private@example|passwordHash|balance|sortKey|email|pro"/)
})

test("circular pagination covers the entire eligible pool without duplicates or a candidate cap", async () => {
  const f = fixture()
  for (let index = 0; index < 47; index++) await developer(f, `dev-${index}`)
  const now = new Date("2026-11-11T12:00:00Z"), ids = []
  for (const page of [1, 2, 3]) {
    const result = await f.readDeveloperDirectory(query({ page }), now)
    assert.equal(result.total, 47); assert.equal(result.items.length, page === 3 ? 7 : 20)
    ids.push(...result.items.map(item => item.id))
  }
  assert.equal(new Set(ids).size, 47)
  assert.equal((await f.readDeveloperDirectory(query({ page: 4 }), now)).items.length, 0)
  const firsts = new Set()
  for (let day = 0; day < 47; day++) firsts.add((await f.readDeveloperDirectory(query(), new Date(now.getTime() + day * 86400000))).items[0].id)
  assert.equal(firsts.size, 47)
  const tomorrow = await f.readDeveloperDirectory(query(), new Date(now.getTime() + 86400000))
  assert.equal(tomorrow.items[0].id, ids[1])
})

test("query parsing rejects duplicate, invalid and oversized filters without introducing paid ranking", () => {
  const { parseDeveloperQuery, developerWhere } = loadModule("src/lib/developers/query.ts")
  for (const query of ["page=0", "page=10001", "availability=PRO", "q=a&q=b", `q=${"x".repeat(121)}`, "specialization=ADMIN"]) assert.equal(parseDeveloperQuery(new URLSearchParams(query)).success, false)
  const parsed = parseDeveloperQuery(new URLSearchParams("q=  Python &specialization=SCRIPTS&availability=LIMITED&sort=paid"))
  assert.equal(parsed.success, true); assert.equal(parsed.value.q, "Python")
  assert.doesNotMatch(JSON.stringify(developerWhere(parsed.value)), /paid|review|rating|plan/)
})

test("an invitation creates one notification, no proposal/contract and no charge even on parallel retries", async () => {
  const f = fixture(); await developer(f); openJob(f)
  const results = await Promise.all([f.inviteDeveloper({ id: "owner" }, "job", "dev"), f.inviteDeveloper({ id: "owner" }, "job", "dev")])
  assert.equal(f.state().jobInvitation.length, 1); assert.equal(f.state().jobNotification.length, 1)
  assert.equal(results.flatMap(result => result.notificationIds).length, 1)
  assert.equal(f.state().jobProposal.length + f.state().jobContract.length + f.state().purchase.length, 0)
  assert.equal(f.state().exposureEvent[0].kind, "INVITATION")
})

test("invitation authorization rechecks owner, ban, availability, publication, deadline and specialization", async () => {
  const cases = [
    async f => { await assert.rejects(() => f.inviteDeveloper({ id: "dev" }, "job", "dev"), /заказчик/) },
    async f => { await f.db.user.update({ where: { id: "owner" }, data: { isBanned: true } }); await assert.rejects(() => f.inviteDeveloper({ id: "owner" }, "job", "dev"), /недоступен/) },
    async f => { await f.db.user.update({ where: { id: "dev" }, data: { isBanned: true } }); await assert.rejects(() => f.inviteDeveloper({ id: "owner" }, "job", "dev"), /недоступен/) },
    async f => { await f.saveDeveloperProfile("dev", profile({ availability: "UNAVAILABLE" })); await assert.rejects(() => f.inviteDeveloper({ id: "owner" }, "job", "dev"), /недоступен/) },
    async f => { await f.db.job.update({ where: { id: "job" }, data: { specialization: "WEB" } }); await assert.rejects(() => f.inviteDeveloper({ id: "owner" }, "job", "dev"), /направление/) },
    async f => { await f.db.job.update({ where: { id: "job" }, data: { publicationStatus: "SUSPENDED" } }); await assert.rejects(() => f.inviteDeveloper({ id: "owner" }, "job", "dev"), /опубликованного/) },
    async f => { await f.db.job.update({ where: { id: "job" }, data: { deadline: new Date(0) } }); await assert.rejects(() => f.inviteDeveloper({ id: "owner" }, "job", "dev"), /опубликованного/) },
  ]
  for (const check of cases) { const f = fixture(); await developer(f); openJob(f); await check(f); assert.equal(f.state().jobInvitation.length, 0) }
})

test("persistent invitation limits cannot be bypassed by requests to different orders", async () => {
  const f = fixture(); await developer(f); openJob(f)
  for (let index = 0; index < 10; index++) f.seed("jobInvitation", { jobId: "job", developerId: `old-${index}` })
  await assert.rejects(() => f.inviteDeveloper({ id: "owner" }, "job", "dev"), /до 10/)
  for (let index = 0; index < 10; index++) { openJob(f, `other-${index}`); f.seed("jobInvitation", { jobId: `other-${index}`, developerId: "other" }) }
  openJob(f, "fresh")
  await assert.rejects(() => f.inviteDeveloper({ id: "owner" }, "fresh", "dev"), /24 часа/)
})

test("invitation, notification and signal roll back together after storage failure", async () => {
  const f = fixture(); await developer(f); openJob(f)
  f.control.rejectWrite = name => { if (name === "jobNotification") throw new Error("inbox failure") }
  await assert.rejects(() => f.inviteDeveloper({ id: "owner" }, "job", "dev"), /failure/)
  assert.equal(f.state().jobInvitation.length + f.state().exposureEvent.length, 0)
})

test("lost invitation commit reply is safely recovered by retry without a second notification", async () => {
  const f = fixture(); await developer(f); openJob(f); f.control.commitError = true
  await assert.rejects(() => f.inviteDeveloper({ id: "owner" }, "job", "dev"), /uncertain/)
  await f.inviteDeveloper({ id: "owner" }, "job", "dev")
  assert.equal(f.state().jobInvitation.length, 1); assert.equal(f.state().jobNotification.length, 1); assert.equal(f.state().exposureEvent.length, 1)
})

test("exposure deduplicates daily per browser, kind and profile, including concurrent/uncertain delivery", async () => {
  const f = fixture(); await developer(f); const now = new Date("2026-11-11T12:00:00Z")
  await Promise.all([f.recordExposure("IMPRESSION", ["dev", "dev"], "visitor", now), f.recordExposure("IMPRESSION", ["dev"], "visitor", now)])
  assert.equal(f.state().exposureEvent.length, 1)
  f.control.commitError = true; await f.recordExposure("PROFILE_OPEN", ["dev"], "visitor", now)
  await f.recordExposure("PROFILE_OPEN", ["dev"], "visitor", now)
  assert.equal(f.state().exposureEvent.length, 2)
  await f.recordExposure("PROFILE_OPEN", ["dev"], "visitor", new Date("2026-11-12T00:00:00Z"))
  assert.equal(f.state().exposureEvent.length, 3)
  assert.doesNotMatch(JSON.stringify(f.state().exposureEvent), /visitor|developerId|userId|jobId|email|ip"/)
})

test("hidden and banned accounts cannot accumulate new public exposure", async () => {
  const f = fixture(); await developer(f)
  await f.saveDeveloperProfile("dev", profile({ listed: false }))
  await f.recordExposure("IMPRESSION", ["dev", "nonexistent"], "v")
  assert.equal(f.state().exposureEvent.length, 0)
})

test("business events count original transactions once and keep cohort at event time", async () => {
  const f = fixture(); await developer(f); openJob(f)
  const offer = { amount: 15000, durationDays: 2, approach: "Подготовлю автоматизацию с тестовым набором и инструкцией.", revision: 0 }
  await f.saveProposal({ id: "dev" }, "job", offer)
  await f.saveProposal({ id: "dev" }, "job", { ...offer, amount: 16000, revision: 1 })
  const chosen = { action: "SELECT", proposalId: f.state().jobProposal[0].id, proposalRevision: 2 }
  await f.runJobCommand({ id: "owner" }, "job", chosen); await f.runJobCommand({ id: "owner" }, "job", chosen)
  await f.runJobCommand({ id: "dev" }, "job", { action: "START" })
  await f.runJobCommand({ id: "dev" }, "job", { action: "DISPUTE", reason: "Нужна помощь в уточнении согласованного результата" })
  await f.runJobCommand({ id: "mod" }, "job", { action: "RESUME", reason: "Стороны согласовали продолжение работы" })
  assert.equal(f.state().exposureEvent.filter(row => row.kind === "DISPUTE").length, 1)
  // A retained dispute must not become a new event after metric retention has
  // removed its old deduplication row; the business record remains authoritative.
  await f.db.exposureEvent.deleteMany({ where: { kind: "DISPUTE" } })
  await f.runJobCommand({ id: "dev" }, "job", { action: "DISPUTE", reason: "Повторно требуется помощь в согласовании результата" })
  assert.equal(f.state().exposureEvent.filter(row => row.kind === "DISPUTE").length, 0)
  await f.runJobCommand({ id: "mod" }, "job", { action: "RESUME", reason: "Стороны согласовали продолжение работы" })
  await f.runJobCommand({ id: "dev" }, "job", { action: "DELIVER", id: "delivery", text: "Результат подготовлен и проверен на тестовом наборе.", attachmentIds: [] })
  await f.runJobCommand({ id: "owner" }, "job", { action: "ACCEPT", deliveryId: "delivery" }); await f.runJobCommand({ id: "owner" }, "job", { action: "ACCEPT", deliveryId: "delivery" })
  assert.deepEqual(f.state().exposureEvent.map(row => row.kind).sort(), ["COMPLETION", "PROPOSAL", "SELECTION"])
  assert.ok(f.state().exposureEvent.every(row => row.cohort === "FIRST_DEALS"))
  await f.recordExposure("PROFILE_OPEN", ["dev"], "v")
  assert.equal(f.state().exposureEvent.at(-1).cohort, "RECORDED_DEALS")
})

test("signed event API rejects forged or expired targets and obeys consent and origin", async () => {
  const f = fixture(); await developer(f)
  const route = f.load("src/app/api/developers/events/route.ts"), token = f.exposureToken("IMPRESSION", ["dev"])
  const request = (body, cookie = "cp_cookie_consent=all", origin = "http://localhost") => new Request("http://localhost/api/developers/events", { method: "POST", headers: { origin, cookie, "Content-Type": "application/json" }, body: JSON.stringify(body) })
  assert.equal((await route.POST(request({ token, ids: ["dev"] }, "cp_cookie_consent=necessary"))).status, 204)
  assert.equal(f.state().exposureEvent.length, 0)
  assert.equal((await route.POST(request({ token, ids: ["dev"] }, undefined, "https://foreign.invalid"))).status, 403)
  for (const body of [{ token: token + "x", ids: ["dev"] }, { token, ids: ["foreign"] }, { token: f.exposureToken("IMPRESSION", ["dev"], Date.now() - 3600000), ids: ["dev"] }, { token, ids: ["dev"], cohort: "RECORDED_DEALS" }]) assert.equal((await route.POST(request(body))).status, 422)
  const response = await route.POST(request({ token, ids: ["dev"] }))
  assert.equal(response.status, 204); assert.match(response.headers.get("set-cookie"), /HttpOnly/i)
  const cookie = response.headers.get("set-cookie").split(";")[0]
  assert.equal((await route.POST(request({ token, ids: ["dev"] }, `cp_cookie_consent=all; ${cookie}`))).status, 204)
  assert.equal(f.state().exposureEvent.length, 1)
  assert.match((await route.DELETE(new Request("http://localhost/", { method: "DELETE", headers: { origin: "http://localhost" } }))).headers.get("set-cookie"), /Max-Age=0/)
})

test("guest invitation endpoints reject before reading private order choices", async () => {
  const f = fixture(); f.mocks["@/lib/current-user"] = { getCurrentUser: async () => null }
  const route = f.load("src/app/api/developers/[id]/invitations/route.ts"), params = { params: Promise.resolve({ id: "dev" }) }
  for (const method of ["GET", "POST"]) assert.equal((await route[method](new Request("http://localhost/", { method }), params)).status, 401)
})

test("event origin checks support a local preview even when the build has a production URL", async () => {
  const f = fixture()
  const route = loadModule("src/app/api/developers/events/route.ts", { mocks: f.mocks, env: { ...env, NEXT_PUBLIC_APP_URL: "https://cyberpolka.example.invalid" } })
  for (const origin of ["http://localhost", "https://cyberpolka.example.invalid"]) assert.equal((await route.POST(new Request("http://localhost/api/developers/events", { method: "POST", headers: { origin, cookie: "cp_cookie_consent=necessary" } }))).status, 204)
  assert.equal((await route.POST(new Request("http://localhost:3100/api/developers/events", { method: "POST", headers: { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100", cookie: "cp_cookie_consent=necessary" } }))).status, 204)
  assert.equal((await route.POST(new Request("http://localhost:3100/api/developers/events", { method: "POST", headers: { host: "127.0.0.1:3100", origin: "https://foreign.invalid", "x-forwarded-host": "foreign.invalid" } }))).status, 403)
  assert.equal((await route.POST(new Request("http://localhost/api/developers/events", { method: "POST", headers: { origin: "https://foreign.invalid" } }))).status, 403)
})

test("invitation choices are scoped to the current owner and a strict payload cannot forge recipient or roles", async () => {
  const f = fixture(); await developer(f); openJob(f); openJob(f, "foreign", { customerId: "dev" }); openJob(f, "draft", { publicationStatus: "DRAFT" })
  f.mocks["@/lib/current-user"] = { getCurrentUser: async () => ({ id: "owner", role: "BUYER" }) }
  const route = f.load("src/app/api/developers/[id]/invitations/route.ts"), params = { params: Promise.resolve({ id: "dev" }) }
  const choices = await (await route.GET(new Request("http://localhost/"), params)).json()
  assert.deepEqual(choices.jobs.map(job => job.id), ["job"])
  const response = await route.POST(new Request("http://localhost/", { method: "POST", body: JSON.stringify({ jobId: "job", developerId: "foreign", role: "ADMIN" }) }), params)
  assert.equal(response.status, 422); assert.equal(f.state().jobInvitation.length, 0)
})

test("the aggregate report requires a current staff role and does not publish raw events", async () => {
  const f = fixture(); let reads = 0
  f.mocks["next/navigation"] = { redirect: path => { throw new Error(`redirect:${path}`) } }
  f.mocks["@/lib/developers/metrics"] = { metricsEnabled: () => true, readExposureReport: async () => { reads++; return [] }, SIGNAL_LABELS: {}, COHORT_LABELS: {} }
  for (const actor of [null, { id: "owner", role: "BUYER" }]) {
    f.mocks["@/lib/current-user"] = { getCurrentUser: async () => actor }
    const page = f.load("src/app/admin/exposure/page.tsx").default
    await assert.rejects(page, /redirect:/)
  }
  assert.equal(reads, 0)
})

test("metrics disabled produces no events or signed collection tokens", async () => {
  const f = fixture(), metrics = loadModule("src/lib/developers/metrics.ts", { mocks: f.mocks })
  assert.equal(metrics.exposureToken("PROFILE_OPEN", ["dev"]), null)
  await f.db.$transaction(tx => metrics.recordJobSignal(tx, "PROPOSAL", "p", "dev", "job"))
  assert.equal(f.state().exposureEvent.length, 0)
})

test("cleanup is dry-run by default and deletes only expired metrics in bounded batches", async () => {
  const f = fixture(), now = new Date("2026-11-11T00:00:00Z"), cutoff = new Date(now.getTime() - 31 * 86400000)
  f.seed("exposureEvent", { id: "old", createdAt: new Date(cutoff.getTime() - 1) }); f.seed("exposureEvent", { id: "boundary", createdAt: cutoff }); f.seed("jobInvitation", { id: "history", createdAt: new Date(0) })
  const { cleanupExposureEvents } = f.load("src/lib/developers/cleanup.ts")
  assert.equal((await cleanupExposureEvents({ now })).candidates, 1); assert.equal(f.state().exposureEvent.length, 2)
  assert.equal((await cleanupExposureEvents({ now, apply: true })).deleted, 1); assert.equal(f.state().exposureEvent[0].id, "boundary"); assert.equal(f.state().jobInvitation.length, 1)
})
