import test from "node:test"
import assert from "node:assert/strict"
import { loadModule } from "./helpers/load-module.mjs"
import { storeFixture } from "./helpers/store-fixture.mjs"

function fixture({ credited = true } = {}) {
  const f = storeFixture({ serializeWrites: true })
  f.seed("user", { id: "seller", role: "DEVELOPER", balance: credited ? 8000 : 0 })
  f.seed("user", { id: "buyer" })
  f.seed("product", { id: "product", authorId: "seller", title: "Code", price: 999000, saleModel: "COMMISSION", salesCount: 1 })
  f.seed("purchase", { id: "purchase", buyerId: "buyer", productId: "product", status: "PAID", amount: 10000, developerAmount: 8000, paymentId: "bank-payment", paidAt: new Date(), creditedAt: credited ? new Date() : null, holdUntil: new Date(Date.now() - 1000) })
  const calls = { cancel: 0, receipt: 0, state: 0, receiptStatus: 0, requests: [] }
  const bank = { status: "CONFIRMED", amount: 10000, cancelStatus: "REFUNDED", loseReply: false }
  const kkt = { status: "Queued", loseReply: false }
  const mocks = {
    "@/lib/db": { db: f.db },
    "@/lib/tariffs": { saleModelForKopecks: () => "COMMISSION", commissionRate: () => 0.2 },
    "@/lib/tbank": {
      async getPayment(id) { calls.state++; assert.equal(f.control.inTransaction, false); return { id, status: bank.status, amount: bank.amount } },
      async createRefund(id, amount) { calls.cancel++; assert.equal(f.control.inTransaction, false); assert.equal(amount, 10000); bank.status = bank.cancelStatus; if (bank.loseReply) throw new Error("lost bank reply"); return { id, status: bank.status } },
    },
    "@/lib/cloudkassir": {
      async sendKktReceipt(payload, id) { calls.receipt++; assert.equal(f.control.inTransaction, false); calls.requests.push({ payload, id }); if (kkt.loseReply) throw new Error("lost receipt reply"); return { ok: true, receiptId: "receipt-id" } },
      async getKktReceiptStatus(id) { calls.receiptStatus++; assert.equal(id, "receipt-id"); return kkt.status },
    },
  }
  const refunds = loadModule("src/lib/refunds.ts", { mocks })
  const payouts = loadModule("src/lib/payouts.ts", { mocks })
  const earnings = loadModule("src/lib/earnings.ts", { mocks })
  const claims = loadModule("src/lib/purchase-claims.ts", { mocks })
  return { ...f, ...refunds, ...payouts, ...earnings, ...claims, calls, bank, kkt, seller: () => f.state().user.find(user => user.id === "seller"), purchase: () => f.state().purchase[0], operation: () => f.state().financialOperation[0] }
}

test("parallel payout requests reserve a sale and balance once", async () => {
  const f = fixture()
  const results = await Promise.all(Array.from({ length: 12 }, () => f.createPayoutForDeveloper("seller")))
  assert.equal(results.filter(result => "id" in result).length, 1)
  assert.equal(f.state().payout.length, 1)
  assert.equal(f.seller().balance, 0)
  assert.equal(f.purchase().payoutId, f.state().payout[0].id)
})

test("parallel rejection releases a reserve once and a competing PAID cannot overwrite it", async () => {
  const f = fixture(), payout = await f.createPayoutForDeveloper("seller")
  const results = await Promise.all(Array.from({ length: 8 }, () => f.transitionPayout(payout.id, "REJECTED", "admin")))
  assert.equal(results.filter(result => result.applied).length, 1)
  assert.equal(f.seller().balance, 8000)
  assert.equal(f.purchase().payoutId, null)
  await assert.rejects(() => f.transitionPayout(payout.id, "PAID", "admin"), /изменился/)
  assert.equal(f.calls.receipt, 0)
})

test("PAID and rejection race has one winner and one ledger effect", async () => {
  const f = fixture(), payout = await f.createPayoutForDeveloper("seller")
  const results = await Promise.allSettled([f.transitionPayout(payout.id, "PAID", "admin"), f.transitionPayout(payout.id, "REJECTED", "admin")])
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1)
  const paid = f.state().payout[0].status === "PAID"
  assert.equal(f.seller().balance, paid ? 0 : 8000)
  assert.equal(f.state().financialOperation.length, paid ? 1 : 0)
  assert.equal(f.calls.receipt, 0, "external receipt creation follows the confirmed transaction")
})

test("frozen, banned and insufficient balances cannot create a withdrawal", async () => {
  for (const patch of [{ payoutsFrozen: true }, { isBanned: true }, { balance: 7999 }]) {
    const f = fixture(); Object.assign(f.seller(), patch)
    assert.ok("error" in await f.createPayoutForDeveloper("seller"))
    assert.equal(f.state().payout.length, 0)
    assert.equal(f.purchase().payoutId, null)
  }
})

test("open claims or pending refunds block a new payout", async () => {
  for (const name of ["supportTicket", "financialOperation"]) {
    const f = fixture()
    f.seed(name, name === "supportTicket" ? { id: "claim", purchaseId: "purchase", category: "CLAIM" } : { id: "refund:purchase", kind: "REFUND", referenceId: "purchase", status: "UNKNOWN" })
    assert.ok("error" in await f.createPayoutForDeveloper("seller"))
    assert.equal(f.seller().balance, 8000)
  }
})

test("parallel hold release credits one sale once", async () => {
  const f = fixture({ credited: false })
  const counts = await Promise.all(Array.from({ length: 10 }, () => f.releaseExpiredHolds()))
  assert.equal(counts.reduce((a, b) => a + b, 0), 1)
  assert.equal(f.seller().balance, 8000)
  assert.ok(f.purchase().creditedAt)
})

test("hold release rechecks claims, pending refunds and paid state", async () => {
  for (const block of ["claim", "refund", "refunded", "future"]) {
    const f = fixture({ credited: false })
    if (block === "claim") f.seed("supportTicket", { purchaseId: "purchase", category: "CLAIM" })
    if (block === "refund") f.seed("financialOperation", { id: "refund:purchase", status: "UNKNOWN" })
    if (block === "refunded") f.purchase().status = "REFUNDED"
    if (block === "future") f.purchase().holdUntil = new Date(Date.now() + 100000)
    assert.equal(await f.releaseExpiredHolds(), 0)
    assert.equal(f.seller().balance, 0)
  }
})

test("parallel full refunds send one Cancel and apply one debit and sales decrement", async () => {
  const f = fixture()
  f.seed("supportTicket", { purchaseId: "purchase", category: "CLAIM" })
  await Promise.all(Array.from({ length: 10 }, () => f.refundPurchase("purchase", "admin")))
  assert.equal(f.calls.cancel, 1)
  assert.equal(f.seller().balance, 0)
  assert.equal(f.purchase().status, "REFUNDED")
  assert.equal(f.state().product[0].salesCount, 0)
  assert.equal(f.state().supportTicket[0].status, "RESOLVED")
  assert.equal(f.operation().status, "APPLIED")
  assert.equal((await f.refundPurchase("purchase", "admin")).ok, true)
  assert.equal(f.calls.cancel, 1)
})

test("asynchronous refund retains funds until bank confirms and only reconciles thereafter", async () => {
  const f = fixture({ credited: false }); f.bank.cancelStatus = "REFUNDING"
  assert.equal((await f.refundPurchase("purchase", "admin")).pending, true)
  assert.equal(f.purchase().status, "PAID")
  assert.equal(await f.releaseExpiredHolds(), 0)
  assert.equal((await f.refundPurchase("purchase", "admin")).pending, true)
  f.bank.status = "REFUNDED"
  assert.equal((await f.refundPurchase("purchase", "admin")).ok, true)
  assert.equal(f.calls.cancel, 1)
  assert.equal(f.seller().balance, 0)
})

test("a lost Cancel reply is reconciled without ever sending another Cancel", async () => {
  const f = fixture(); f.bank.loseReply = true
  assert.equal((await f.refundPurchase("purchase", "admin")).pending, true)
  assert.equal(f.operation().status, "UNKNOWN")
  f.bank.status = "CONFIRMED"
  for (let i = 0; i < 3; i++) assert.equal((await f.refundPurchase("purchase", "admin")).pending, true)
  assert.equal(f.calls.cancel, 1)
  f.bank.status = "REFUNDED"
  assert.equal((await f.refundPurchase("purchase", "admin")).ok, true)
  assert.equal(f.seller().balance, 0)
})

test("a failed local refund commit rolls back accounting and retries only local application", async () => {
  const f = fixture()
  f.control.rejectWrite = (name, data) => { if (name === "financialOperation" && data.status === "APPLIED") throw new Error("ledger unavailable") }
  await assert.rejects(() => f.refundPurchase("purchase", "admin"), /ledger unavailable/)
  assert.equal(f.purchase().status, "PAID")
  assert.equal(f.seller().balance, 8000)
  assert.equal(f.state().product[0].salesCount, 1)
  assert.equal(f.operation().status, "CONFIRMED")
  f.control.rejectWrite = null
  await f.refundPurchase("purchase", "admin")
  assert.equal(f.calls.cancel, 1)
  assert.equal(f.seller().balance, 0)
})

test("lost prepare reply keeps the original operation and retry performs its first send", async () => {
  const f = fixture(); f.control.commitError = true
  await assert.rejects(() => f.refundPurchase("purchase", "admin"), /uncertain commit/)
  assert.equal(f.calls.cancel, 0)
  assert.equal(f.operation().status, "PREPARED")
  await f.refundPurchase("purchase", "admin")
  assert.equal(f.calls.cancel, 1)
})

test("direct payments, unsettled payouts, mismatched amounts and partial returns never auto-refund", async () => {
  const direct = fixture(); direct.purchase().paymentId = null
  await assert.rejects(() => direct.refundPurchase("purchase", "admin"), /банковского платежа/)
  const reserved = fixture(); await reserved.createPayoutForDeveloper("seller")
  await assert.rejects(() => reserved.refundPurchase("purchase", "admin"), /незавершённую выплату/)
  for (const patch of [{ amount: 9999 }, { amount: undefined }, { status: "PARTIAL_REFUNDED" }]) {
    const f = fixture(); Object.assign(f.bank, patch)
    assert.equal((await f.refundPurchase("purchase", "admin")).pending, true)
    assert.equal(f.calls.cancel, 0)
    assert.equal(f.purchase().status, "PAID")
  }
  assert.equal(direct.calls.cancel + reserved.calls.cancel, 0)
})

test("legacy refunded purchase is a read-only success", async () => {
  const f = fixture(); f.purchase().status = "REFUNDED"
  assert.equal((await f.refundPurchase("purchase", "admin")).ok, true)
  assert.equal(f.state().financialOperation.length, 0)
  assert.equal(f.seller().balance, 8000)
  assert.equal(f.calls.cancel, 0)
})

test("inconsistent credits and shared bank payments require reconciliation before Cancel", async () => {
  for (const patch of [{ developerAmount: -1 }, { developerAmount: 10001 }, { developerAmount: null }]) {
    const f = fixture(); Object.assign(f.purchase(), patch)
    await assert.rejects(() => f.refundPurchase("purchase", "admin"), /сверки/)
    assert.equal(f.calls.cancel, 0)
  }
  const f = fixture()
  f.seed("purchase", { id: "duplicate-bank-reference", productId: "product", buyerId: "buyer", paymentId: "bank-payment" })
  await assert.rejects(() => f.refundPurchase("purchase", "admin"), /несколькими покупками/)
  assert.equal(f.calls.cancel, 0)
})

test("a return after a completed payout records debt and blocks an uncovered new withdrawal", async () => {
  const f = fixture(), payout = await f.createPayoutForDeveloper("seller")
  await f.transitionPayout(payout.id, "PAID", "admin")
  await f.refundPurchase("purchase", "admin")
  assert.equal(f.seller().balance, -8000)
  f.seed("purchase", { id: "next-sale", productId: "product", buyerId: "buyer", amount: 10000, developerAmount: 8000, status: "PAID", creditedAt: new Date() })
  f.seller().balance += 8000
  assert.ok("error" in await f.createPayoutForDeveloper("seller"))
  assert.equal(f.state().payout.length, 1)
})

test("a claim opened after reservation blocks marking the payout paid", async () => {
  const f = fixture(), payout = await f.createPayoutForDeveloper("seller")
  await f.filePurchaseClaim("buyer", "purchase", "A detailed claim after the reserve")
  await assert.rejects(() => f.transitionPayout(payout.id, "PAID", "admin"), /претензия/)
  assert.equal(f.state().payout[0].status, "PENDING")
  assert.equal(f.calls.receipt, 0)
})

test("a lost final refund commit reply cannot apply accounting a second time", async () => {
  const f = fixture()
  f.control.rejectWrite = (name, data) => { if (name === "financialOperation" && data.status === "APPLIED") f.control.commitError = true }
  await assert.rejects(() => f.refundPurchase("purchase", "admin"), /uncertain commit/)
  assert.equal(f.operation().status, "APPLIED")
  assert.equal(f.seller().balance, 0)
  f.control.rejectWrite = null
  assert.equal((await f.refundPurchase("purchase", "admin")).ok, true)
  assert.equal(f.seller().balance, 0)
  assert.equal(f.calls.cancel, 1)
})

test("parallel receipt checks send once, preserve the snapshot and wait for Processed", async () => {
  const f = fixture(), payout = await f.createPayoutForDeveloper("seller")
  await f.transitionPayout(payout.id, "PAID", "admin")
  f.state().product[0].title = "Changed after payment"
  await Promise.all(Array.from({ length: 8 }, () => f.fiscalizePayout(payout.id)))
  assert.equal(f.calls.receipt, 1)
  assert.equal(f.calls.requests[0].id, `payout-receipt:${payout.id}`)
  assert.equal(f.calls.requests[0].payload.items[0].label, "Code")
  assert.equal(f.state().payout[0].receiptSent, false)
  f.kkt.status = "Processed"
  assert.equal((await f.fiscalizePayout(payout.id)).ok, true)
  assert.equal(f.state().payout[0].receiptSent, true)
  assert.equal(f.operation().status, "APPLIED")
  await f.fiscalizePayout(payout.id)
  assert.equal(f.calls.receipt, 1)
})

test("lost receipt reply never resends, including after the provider's deduplication window", async () => {
  const f = fixture(), payout = await f.createPayoutForDeveloper("seller")
  await f.transitionPayout(payout.id, "PAID", "admin"); f.kkt.loseReply = true
  assert.equal((await f.fiscalizePayout(payout.id)).pending, true)
  f.operation().createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000)
  for (let i = 0; i < 3; i++) await f.fiscalizePayout(payout.id)
  assert.equal(f.calls.receipt, 1)
  assert.equal(f.state().payout[0].receiptSent, false)
  assert.equal(f.operation().status, "UNKNOWN")
})

test("legacy paid payouts are never automatically sent to the receipt service", async () => {
  const f = fixture(); f.seed("payout", { id: "legacy", developerId: "seller", amount: 8000, status: "PAID" })
  await f.transitionPayout("legacy", "PAID", "admin")
  assert.equal((await f.fiscalizePayout("legacy")).ok, false)
  assert.equal(f.calls.receipt, 0)
})

test("failed receipt accounting commit preserves the external ID for safe reconciliation", async () => {
  const f = fixture(), payout = await f.createPayoutForDeveloper("seller")
  await f.transitionPayout(payout.id, "PAID", "admin"); f.kkt.status = "Processed"
  f.control.rejectWrite = (name, data) => { if (name === "payout" && data.receiptSent) throw new Error("receipt ledger unavailable") }
  await assert.rejects(() => f.fiscalizePayout(payout.id), /receipt ledger unavailable/)
  assert.equal(f.operation().providerId, "receipt-id")
  assert.equal(f.operation().status, "CONFIRMED")
  assert.equal(f.state().payout[0].receiptSent, false)
  f.control.rejectWrite = null
  await f.fiscalizePayout(payout.id)
  assert.equal(f.calls.receipt, 1)
  assert.equal(f.state().payout[0].receiptSent, true)
})

test("parallel purchase claims create one ticket and block hold release", async () => {
  const f = fixture({ credited: false })
  const results = await Promise.all(Array.from({ length: 8 }, () => f.filePurchaseClaim("buyer", "purchase", "A detailed claim about this purchase")))
  assert.equal(results.filter(result => result.created).length, 1)
  assert.equal(f.state().supportTicket.length, 1)
  assert.equal(await f.releaseExpiredHolds(), 0)
  assert.equal(f.seller().balance, 0)
  await assert.rejects(() => f.filePurchaseClaim("other", "purchase", "test"), /доступа/)
})
