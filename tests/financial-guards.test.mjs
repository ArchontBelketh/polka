import test from "node:test"
import assert from "node:assert/strict"
import { loadModule } from "./helpers/load-module.mjs"

const params = { params: Promise.resolve({ id: "foreign" }) }
const request = (body) => new Request("http://localhost/fixture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })

test("financial routes deny guests before reaching any accounting or provider", async () => {
  let calls = 0
  const fail = () => { calls++; throw new Error("must not run") }
  const mocks = { "@/lib/current-user": { getCurrentUser: async () => null }, "@/lib/refunds": { refundPurchase: fail }, "@/lib/payouts": { createPayoutForDeveloper: fail, transitionPayout: fail, fiscalizePayout: fail }, "@/lib/purchase-claims": { filePurchaseClaim: fail }, "@/lib/notify": {}, "@/lib/db": { db: {} } }
  for (const [file, method, body] of [
    ["src/app/api/admin/purchases/[id]/refund/route.ts", "POST", {}],
    ["src/app/api/admin/payouts/[id]/route.ts", "PATCH", { status: "PAID" }],
    ["src/app/api/admin/payouts/route.ts", "POST", { developerId: "foreign" }],
    ["src/app/api/payouts/route.ts", "POST", {}],
    ["src/app/api/payouts/route.ts", "GET", {}],
    ["src/app/api/purchases/[id]/claim/route.ts", "POST", { text: "A detailed claim from an outsider" }],
  ]) {
    const route = loadModule(file, { mocks })
    const response = await route[method](request(body), params)
    assert.equal(response.status, 401, file)
  }
  assert.equal(calls, 0)
})

test("a current non-admin role cannot invoke financial administration", async () => {
  const mocks = { "@/lib/current-user": { getCurrentUser: async () => ({ id: "user", role: "BUYER" }) }, "@/lib/refunds": {}, "@/lib/payouts": {} }
  for (const [file, method] of [["src/app/api/admin/purchases/[id]/refund/route.ts", "POST"], ["src/app/api/admin/payouts/[id]/route.ts", "PATCH"], ["src/app/api/admin/payouts/route.ts", "POST"]]) {
    assert.equal((await loadModule(file, { mocks })[method](request({ status: "PAID" }), params)).status, 403)
  }
})

test("refund API distinguishes pending bank evidence from completed accounting", async () => {
  let complete = false
  const route = loadModule("src/app/api/admin/purchases/[id]/refund/route.ts", {
    env: { TBANK_TERMINAL_KEY: "test", TBANK_PASSWORD: "test" },
    mocks: { "@/lib/current-user": { getCurrentUser: async () => ({ id: "admin", role: "ADMIN" }) }, "@/lib/refunds": { refundPurchase: async () => ({ ok: complete, pending: !complete }) } },
  })
  const pending = await route.POST(request({}), params)
  assert.equal(pending.status, 202)
  assert.equal((await pending.json()).ok, false)
  assert.match(pending.headers.get("Cache-Control"), /no-store/)
  complete = true
  assert.equal((await route.POST(request({}), params)).status, 200)
})

test("claim response exposes its ticket ID without developer notification contacts", async () => {
  const route = loadModule("src/app/api/purchases/[id]/claim/route.ts", {
    mocks: { "@/lib/current-user": { getCurrentUser: async () => ({ id: "buyer" }) }, "@/lib/purchase-claims": { filePurchaseClaim: async () => ({ created: true, ticketId: "ticket", notice: { developerEmail: "private@example.invalid" } }) }, "@/lib/notify": { notifyClaimFiled: async () => {} } },
  })
  const response = await route.POST(request({ text: "A sufficiently detailed purchase claim" }), params)
  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), { ticketId: "ticket" })
})
