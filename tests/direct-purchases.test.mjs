import test from "node:test"
import assert from "node:assert/strict"
import { loadModule } from "./helpers/load-module.mjs"

function fixture() {
  const purchase = { id: "purchase-1", productId: "product-1", status: "AWAITING", product: { authorId: "author-1", title: "Test product" }, buyer: { telegramId: null, email: null } }
  let sales = 0
  let notifications = 0
  const db = {
    purchase: {
      findUnique: async () => structuredClone(purchase),
      async updateMany({ where, data }) {
        if (purchase.status !== where.status) return { count: 0 }
        Object.assign(purchase, data)
        return { count: 1 }
      },
    },
    product: { async update() { sales++ } },
    async $transaction(work) { return work(this) },
  }
  const mocks = {
    "@/lib/auth": { auth: async () => ({ user: { id: "author-1" } }) }, "@/lib/db": { db },
    "@/lib/notify": { async notifyListingPurchaseConfirmed() { notifications++ }, async notifyPurchaseDeclined() { notifications++ } },
  }
  const confirm = loadModule("src/app/api/purchases/[id]/confirm/route.ts", { mocks }).POST
  const reject = loadModule("src/app/api/purchases/[id]/reject/route.ts", { mocks }).POST
  const params = { params: Promise.resolve({ id: "purchase-1" }) }
  return { confirm: () => confirm({}, params), reject: () => reject({}, params), purchase, sales: () => sales, notifications: () => notifications }
}

test("parallel confirmations of direct payment count one sale and send one notification", async () => {
  const f = fixture()
  const responses = await Promise.all([f.confirm(), f.confirm()])
  assert.equal(responses.filter((r) => r.status === 200).length, 1)
  assert.equal(f.purchase.status, "DELIVERED")
  assert.equal(f.sales(), 1)
  assert.equal(f.notifications(), 1)
})

test("confirmation and rejection cannot both win the same purchase", async () => {
  const f = fixture()
  const responses = await Promise.all([f.confirm(), f.reject()])
  assert.equal(responses.filter((r) => r.status === 200).length, 1)
  assert.equal(f.sales(), f.purchase.status === "DELIVERED" ? 1 : 0)
  assert.equal(f.notifications(), 1)
})
