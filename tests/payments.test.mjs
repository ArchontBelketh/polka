import test from "node:test"
import assert from "node:assert/strict"
import { loadModule } from "./helpers/load-module.mjs"

function fixture(overrides = {}) {
  let state = {
    intent: { id: "intent-1", orderId: "order-1", paymentId: "payment-1", type: "slots", payload: { userId: "user-1", slotsAdded: "5" }, amount: 100, status: "PENDING", ...overrides },
    slots: 2, sales: 0, balance: 0,
    purchase: { id: "purchase-1", productId: "product-1", status: "PENDING", amount: 100, product: { authorId: "author-1", title: "Test product" }, buyer: { email: null } },
  }
  let notifications = 0
  let queue = Promise.resolve()
  let failStatusWrite = false
  const db = {
    paymentIntent: { findUnique: async () => structuredClone(state.intent) },
    user: { findUnique: async () => ({ role: "ADMIN" }) },
    async $transaction(work) {
      let release
      let draft
      const tx = {
        async $queryRaw(sql, id) {
          assert.match(sql.join("?"), /FOR UPDATE/)
          assert.equal(id, state.intent.id)
          const previous = queue
          queue = new Promise((resolve) => { release = resolve })
          await previous
          draft = structuredClone(state)
          return [{ id }]
        },
        paymentIntent: {
          async findUniqueOrThrow() { return structuredClone(draft.intent) },
          async update({ data }) {
            if (failStatusWrite) throw new Error("database write failed")
            Object.assign(draft.intent, data)
          },
        },
        developerPlan: {
          async upsert({ update }) { await Promise.resolve(); draft.slots += update.totalSlots.increment },
          findUnique: async () => null,
        },
        purchase: {
          findUnique: async () => structuredClone(draft.purchase),
          async updateMany({ where, data }) {
            if (draft.purchase.status !== where.status) return { count: 0 }
            Object.assign(draft.purchase, data)
            return { count: 1 }
          },
        },
        product: { async update() { draft.sales++ } },
        user: { async update({ data }) { draft.balance += data.balance.increment }, findUnique: async () => ({ telegramId: null }) },
      }
      try {
        const result = await work(tx)
        state = draft
        return result
      } finally {
        release?.()
      }
    },
  }
  const { applyPaymentOutcome } = loadModule("src/lib/payments.ts", {
    mocks: {
      "@/lib/db": { db }, "@/lib/tbank": {}, "@/lib/earnings": { developerPayout: () => 80 },
      "@/lib/tariffs": { payoutHoldThresholdKopecks: 1000 },
      "@/lib/notify": { async notifyNewSale() { assert.equal(state.intent.status, "CONFIRMED"); notifications++ } },
      "@/lib/payout-profile": {}, "@/lib/s3": {},
    },
  })
  return { applyPaymentOutcome, db, apply: (outcome = "CONFIRMED", paymentId = "payment-1") => applyPaymentOutcome("intent-1", paymentId, outcome), state: () => state, notifications: () => notifications, failStatusWrite: (value) => { failStatusWrite = value } }
}

test("parallel notifications and manual rechecks grant a slot purchase once", async () => {
  const f = fixture()
  const results = await Promise.all(Array.from({ length: 12 }, () => f.apply()))
  assert.equal(results.filter((r) => r.applied).length, 1)
  assert.equal(f.state().slots, 7)
  assert.equal(f.state().intent.status, "CONFIRMED")
})

test("a failed status write rolls back fulfillment and a retry can succeed", async () => {
  const f = fixture()
  f.failStatusWrite(true)
  await assert.rejects(f.apply(), /database write failed/)
  assert.equal(f.state().slots, 2)
  assert.equal(f.state().intent.status, "PENDING")
  f.failStatusWrite(false)
  await f.apply()
  assert.equal(f.state().slots, 7)
})

test("late failure does not overwrite a confirmed payment", async () => {
  const f = fixture()
  await f.apply()
  const result = await f.apply("FAILED")
  assert.equal(result.applied, false)
  assert.equal(f.state().intent.status, "CONFIRMED")
  assert.equal(f.state().slots, 7)
})

test("a different bank payment cannot fulfill an intent", async () => {
  const f = fixture()
  await assert.rejects(f.apply("CONFIRMED", "another-payment"), /does not match/)
  assert.equal(f.state().slots, 2)
  assert.equal(f.state().intent.status, "PENDING")
})

test("unknown payment types stay pending rather than claiming successful fulfillment", async () => {
  const f = fixture({ type: "unknown-service" })
  await assert.rejects(f.apply(), /Unknown payment type/)
  assert.equal(f.state().intent.status, "PENDING")
})

test("missing fulfillment payload rolls back the payment", async () => {
  const f = fixture({ payload: {} })
  await assert.rejects(f.apply(), /incomplete/)
  assert.equal(f.state().intent.status, "PENDING")
})

test("a purchased product credits balance, sales and buyer access exactly once", async () => {
  const f = fixture({ type: "purchase", payload: { purchaseId: "purchase-1" } })
  await Promise.all([f.apply(), f.apply(), f.apply()])
  assert.equal(f.state().purchase.status, "PAID")
  assert.equal(f.state().balance, 80)
  assert.equal(f.state().sales, 1)
  assert.equal(f.notifications(), 1)
})

test("purchase fulfillment rolls back access, balance and sales together", async () => {
  const f = fixture({ type: "purchase", payload: { purchaseId: "purchase-1" } })
  f.failStatusWrite(true)
  await assert.rejects(f.apply(), /database write failed/)
  assert.equal(f.state().purchase.status, "PENDING")
  assert.equal(f.state().balance, 0)
  assert.equal(f.state().sales, 0)
  assert.equal(f.notifications(), 0)
})

function routeFixture(f, { verified = true, bankFails = false } = {}) {
  const mocks = {
    "@/lib/db": { db: f.db }, "@/lib/payments": { applyPaymentOutcome: f.applyPaymentOutcome },
    "@/lib/auth": { auth: async () => ({ user: { id: "admin-1" } }) },
    "@/lib/tbank": { verifyNotificationToken: () => verified, getPayment: async () => { if (bankFails) throw new Error("Bank unavailable"); return { status: "CONFIRMED" } } },
  }
  return {
    webhook: loadModule("src/app/api/payment/webhook/route.ts", { mocks, env: { TBANK_PASSWORD: "test-only-secret" } }).POST,
    recheck: loadModule("src/app/api/admin/payments/[id]/recheck/route.ts", { mocks }).POST,
  }
}

function notification(amount = 100) {
  return new Request("http://localhost/api/payment/webhook", { method: "POST", body: JSON.stringify({ Status: "CONFIRMED", Success: true, Amount: amount, OrderId: "order-1", PaymentId: "payment-1" }) })
}

test("the real webhook and manual recheck share one atomic fulfillment path", async () => {
  const f = fixture()
  const r = routeFixture(f)
  const results = await Promise.all([r.webhook(notification()), r.recheck({}, { params: Promise.resolve({ id: "intent-1" }) })])
  assert.deepEqual(results.map((res) => res.status), [200, 200])
  assert.equal(f.state().slots, 7)
})

test("a signed notification with a different amount cannot grant a purchase", async () => {
  const f = fixture()
  const response = await routeFixture(f).webhook(notification(101))
  assert.equal(response.status, 400)
  assert.equal(f.state().slots, 2)
})

test("unverified notifications never fulfill a payment", async () => {
  const f = fixture()
  assert.equal((await routeFixture(f, { verified: false }).webhook(notification())).status, 403)
  assert.equal(f.state().intent.status, "PENDING")
})

test("bank verification failure leaves the payment pending for a later retry", async () => {
  const f = fixture()
  assert.equal((await routeFixture(f, { bankFails: true }).webhook(notification())).status, 502)
  assert.equal(f.state().slots, 2)
  assert.equal(f.state().intent.status, "PENDING")
})
