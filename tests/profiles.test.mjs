import test from "node:test"
import assert from "node:assert/strict"
import { loadModule } from "./helpers/load-module.mjs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

const valid = () => ({ headline: "Интеграции", skills: ["TypeScript", "typescript", "1С"], specializations: ["BOTS", "BOTS"], availability: "LIMITED", portfolio: [{ title: "Бот для заявок", description: "Собственная работа", url: "https://example.invalid/project" }] })
const request = (body, method = "PUT") => new Request("http://localhost/api/developer/profile", { method, body: JSON.stringify(body) })

function currentUserFixture(record, session = { user: { id: "owner", role: "ADMIN" } }) {
  let reads = 0
  const { getCurrentUser } = loadModule("src/lib/current-user.ts", { mocks: {
    "server-only": {}, "@/lib/auth": { auth: async () => session },
    "@/lib/db": { db: { user: { findUnique: async () => { reads++; return record } } } },
  } })
  return { getCurrentUser, reads: () => reads }
}

test("profile access rejects guests, removed accounts and freshly banned accounts", async () => {
  const guest = currentUserFixture(null, null)
  assert.equal(await guest.getCurrentUser(), null)
  assert.equal(guest.reads(), 0)
  assert.equal(await currentUserFixture(null).getCurrentUser(), null)
  assert.equal(await currentUserFixture({ id: "owner", role: "DEVELOPER", isBanned: true }).getCurrentUser(), null)
})

test("profile access uses the current database role rather than a stale session role", async () => {
  const user = await currentUserFixture({ id: "owner", role: "BUYER", isBanned: false }).getCurrentUser()
  assert.equal(user.role, "BUYER")
})

function profileFixture(user = { id: "owner", role: "DEVELOPER" }) {
  const writes = []
  const tx = {
    user: { updateMany: async () => ({ count: 1 }), findUnique: async () => ({ ...user, isBanned: false }) },
    developerProfile: { upsert: async (args) => { writes.push(args); return {} } },
    developerListing: { updateMany: async () => ({ count: 0 }) },
  }
  const { PUT } = loadModule("src/app/api/developer/profile/route.ts", { mocks: {
    "@/lib/current-user": { getCurrentUser: async () => user },
    "@/lib/db": { db: { $transaction: async fn => fn(tx) } },
    "@/lib/ratelimit": { rateLimit: () => true },
  } })
  return { PUT, writes }
}

test("profile editing requires an active developer or administrator", async () => {
  for (const [user, status] of [[null, 401], [{ id: "owner", role: "BUYER" }, 403], [{ id: "owner", role: "MODERATOR" }, 403]]) {
    const fixture = profileFixture(user)
    assert.equal((await fixture.PUT(request(valid()))).status, status)
    assert.equal(fixture.writes.length, 0)
  }
})

test("profile writes are owned by the session and normalize skills without changing account privileges", async () => {
  const fixture = profileFixture()
  assert.equal((await fixture.PUT(request(valid()))).status, 200)
  const saved = fixture.writes[0]
  assert.equal(saved.where.userId, "owner")
  assert.equal(saved.create.userId, "owner")
  assert.deepEqual(Array.from(saved.update.skills), ["TypeScript", "1С"])
  assert.deepEqual(Array.from(saved.update.specializations), ["BOTS"])
  assert.equal(saved.update.availability, "LIMITED")
  assert.ok(!Object.hasOwn(saved.update, "role"))
  assert.ok(!Object.hasOwn(saved.update, "balance"))
})

test("profile payloads cannot target another account or forge staff powers and ratings", async () => {
  for (const field of ["userId", "role", "rating", "balance", "isBanned"]) {
    const fixture = profileFixture()
    assert.equal((await fixture.PUT(request({ ...valid(), [field]: "forged" }))).status, 422)
    assert.equal(fixture.writes.length, 0)
  }
})

test("portfolio rejects executable URLs, embedded credentials, unknown directions and oversized data", async () => {
  for (const url of ["javascript:alert(1)", "data:text/html,test", "http://example.invalid", "https://user:password@example.invalid/"]) {
    const fixture = profileFixture()
    const body = valid(); body.portfolio[0].url = url
    assert.equal((await fixture.PUT(request(body))).status, 422)
    assert.equal(fixture.writes.length, 0)
  }
  for (const extra of [{ specializations: ["STAFF"] }, { skills: Array(21).fill("TypeScript") }, { portfolio: Array(7).fill(valid().portfolio[0]) }, { headline: "a".repeat(121) }]) {
    assert.equal((await profileFixture().PUT(request({ ...valid(), ...extra }))).status, 422)
  }
})

test("profile form accepts clearing optional fields and reports malformed JSON without writing", async () => {
  const fixture = profileFixture()
  assert.equal((await fixture.PUT(request({ headline: "", skills: [], specializations: [], availability: "UNAVAILABLE", portfolio: [] }))).status, 200)
  assert.equal(fixture.writes[0].update.headline, null)
  assert.equal((await fixture.PUT(new Request("http://localhost/api/developer/profile", { method: "PUT", body: "{" }))).status, 422)
  assert.equal(fixture.writes.length, 1)
})

test("public profiles exclude private contacts and defensively discard invalid stored links", async () => {
  let query
  const { getPublicDeveloper } = loadModule("src/lib/public-developer.ts", { mocks: {
    "server-only": {},
    "@/lib/db": { db: { user: { findFirst: async (args) => {
      query = args
      return { id: "dev", name: "Автор", bio: "Описание", createdAt: new Date(), email: "private@example.invalid", phone: "+79990000000", passwordHash: "private-hash", developerProfile: { headline: "Headline", skills: [], specializations: [], availability: "AVAILABLE", portfolio: [{ title: "Unsafe", description: "", url: "javascript:alert(1)" }, valid().portfolio[0]] } }
    } } } },
  } })
  const result = await getPublicDeveloper("dev")
  assert.equal(query.where.isBanned, false)
  assert.deepEqual(Array.from(query.where.role.in), ["DEVELOPER", "ADMIN"])
  for (const field of ["email", "phone", "telegramHandle", "passwordHash", "role", "balance"]) {
    assert.ok(!Object.hasOwn(query.select, field))
    assert.ok(!Object.hasOwn(result, field))
  }
  assert.equal(result.portfolio.length, 1)
  assert.equal(result.portfolio[0].url, "https://example.invalid/project")
})

test("public profile lookup returns no data for a hidden or nonexistent account", async () => {
  const { getPublicDeveloper } = loadModule("src/lib/public-developer.ts", { mocks: { "server-only": {}, "@/lib/db": { db: { user: { findFirst: async () => null } } } } })
  assert.equal(await getPublicDeveloper("hidden"), null)
})

function upgradeFixture({ role = "BUYER", failProfile = false, changedRole } = {}) {
  const state = { role, plans: 0, profiles: 0, perks: 0, transactions: 0 }
  const { POST } = loadModule("src/app/api/developer/upgrade/route.ts", { mocks: {
    "@/lib/current-user": { getCurrentUser: async () => ({ id: "owner", role }) },
    "@/lib/early-seller": { claimEarlySellerSpot: async () => { state.perks++ } },
    "@/lib/db": { db: { $transaction: async (fn) => {
      state.transactions++
      const pending = { ...state, role: changedRole ?? state.role }
      const result = await fn({
        user: {
          updateMany: async ({ where, data }) => {
            assert.equal(where.id, "owner"); assert.equal(where.role, "BUYER"); assert.equal(where.isBanned, false)
            if (pending.role === "BUYER") { pending.role = data.role; return { count: 1 } }
            return { count: 0 }
          },
          findUnique: async () => ({ role: pending.role, isBanned: false }),
        },
        developerPlan: { upsert: async () => { pending.plans++ } },
        developerProfile: { upsert: async () => { if (failProfile) throw new Error("profile unavailable"); pending.profiles++ } },
      })
      Object.assign(state, pending)
      return result
    } } },
  } })
  return { POST, state }
}

test("enabling development creates the profile and plan atomically on the same account", async () => {
  const fixture = upgradeFixture()
  assert.equal((await fixture.POST()).status, 200)
  assert.equal(fixture.state.role, "DEVELOPER")
  assert.equal(fixture.state.profiles, 1)
  assert.equal(fixture.state.plans, 1)
  assert.equal(fixture.state.perks, 1)
})

test("a failed profile creation does not leave an account partially upgraded", async () => {
  const fixture = upgradeFixture({ failProfile: true })
  await assert.rejects(fixture.POST(), /profile unavailable/)
  assert.equal(fixture.state.role, "BUYER")
  assert.equal(fixture.state.profiles, 0)
  assert.equal(fixture.state.plans, 0)
  assert.equal(fixture.state.perks, 0)
})

test("development activation neither demotes staff nor resets existing developer entitlements", async () => {
  for (const role of ["DEVELOPER", "ADMIN"]) {
    const fixture = upgradeFixture({ role })
    assert.equal((await fixture.POST()).status, 200)
    assert.equal(fixture.state.role, role)
    assert.equal(fixture.state.transactions, 0)
  }
  const mod = upgradeFixture({ role: "MODERATOR" })
  assert.equal((await mod.POST()).status, 403)
  const changed = upgradeFixture({ changedRole: "MODERATOR" })
  assert.equal((await changed.POST()).status, 403)
  assert.equal(changed.state.role, "MODERATOR")
  assert.equal(changed.state.profiles, 0)
})

test("personal settings accept clearing a name but reject role or owner injection", async () => {
  let writes = 0
  const { PATCH } = loadModule("src/app/api/settings/route.ts", { mocks: {
    "@/lib/current-user": { getCurrentUser: async () => ({ id: "owner", role: "BUYER" }) },
    "@/lib/db": { db: { user: { update: async ({ where, data }) => { writes++; assert.equal(where.id, "owner"); assert.equal(data.name, null) } } } },
  } })
  assert.equal((await PATCH(request({ name: null }, "PATCH"))).status, 200)
  assert.equal((await PATCH(request({ role: "ADMIN" }, "PATCH"))).status, 422)
  assert.equal((await PATCH(request({ id: "another-account" }, "PATCH"))).status, 422)
  assert.equal(writes, 1)
})

test("the shared dashboard opens for buyers and scopes every counter to their own account", async () => {
  const queries = []
  const { default: DashboardPage } = loadModule("src/app/dashboard/page.tsx", { mocks: {
    "@/lib/current-user": { getCurrentUser: async () => ({ id: "buyer-1", role: "BUYER", name: "Покупатель" }) },
    "@/lib/db": { db: {
      purchase: { count: async (args) => { queries.push(args); assert.equal(args.where.buyerId, "buyer-1"); return 3 } },
      wishlist: { count: async (args) => { queries.push(args); assert.equal(args.where.userId, "buyer-1"); return 2 } },
      supportTicket: { count: async (args) => { queries.push(args); assert.equal(args.where.authorId, "buyer-1"); return 1 } },
    } },
    "next/navigation": { redirect: () => { throw new Error("Buyer must not be redirected") } },
    "next/link": ({ href, children, ...props }) => createElement("a", { href, ...props }, children),
    "@/components/dashboard/SellerOverview": { SellerOverview: () => { throw new Error("Buyer must not load seller data") } },
    "@/app/sell/BecomeDeveloperButton": { BecomeDeveloperButton: () => createElement("button", null, "Включить профиль разработчика") },
  } })
  const html = renderToStaticMarkup(await DashboardPage())
  assert.equal(queries.length, 3)
  assert.match(html, /Мой кабинет/)
  assert.match(html, /Включить профиль разработчика/)
  assert.match(html, /href="\/purchases"/)
  assert.match(html, /href="\/orders\/new"/)
  assert.match(html, /href="\/dashboard\/orders"/)
  assert.doesNotMatch(html, /\/developers|href="\/admin"/)
})

test("a hidden developer does not leak a name through metadata", async () => {
  const { generateMetadata } = loadModule("src/app/developer/[id]/page.tsx", { mocks: {
    "@/lib/public-developer": { getPublicDeveloper: async () => null },
    "@/lib/auth": {}, "@/lib/db": {},
    "@/components/catalog/ProductCard": {},
  } })
  const metadata = await generateMetadata({ params: Promise.resolve({ id: "hidden-user" }) })
  assert.equal(metadata.title, "Профиль недоступен")
  assert.equal(metadata.robots.index, false)
})
