import test from "node:test"
import assert from "node:assert/strict"
import { loadModule } from "./helpers/load-module.mjs"

test("T-Bank validates payment identity and status rather than accepting malformed success", async () => {
  let payload = { Success: true, PaymentId: "payment", Status: "CONFIRMED", Amount: 10000 }
  const requests = []
  const bank = loadModule("src/lib/tbank.ts", { env: { TBANK_TERMINAL_KEY: "test-terminal", TBANK_PASSWORD: "test-password" }, globals: {
    fetch: async (url, options) => { requests.push({ url, options }); return Response.json(payload) },
  } })
  assert.equal((await bank.getPayment("payment")).amount, 10000)
  assert.ok(requests[0].options.signal)
  for (const invalid of [{}, { Success: "true", PaymentId: "payment", Status: "REFUNDED" }, { Success: true, PaymentId: "other", Status: "REFUNDED" }, { Success: true, PaymentId: "payment" }]) {
    payload = invalid
    await assert.rejects(() => bank.getPayment("payment"))
    await assert.rejects(() => bank.createRefund("payment", 10000))
  }
  payload = { Success: true, PaymentId: "payment", Status: "REFUNDING" }
  assert.equal((await bank.createRefund("payment", 10000)).status, "REFUNDING")
  assert.equal(JSON.parse(requests.at(-1).options.body).Amount, 10000)
})

test("CloudKassir requires an accepted receipt ID and supplies the stable request ID", async () => {
  let payload = { Success: true, Model: { Id: "receipt-id", ErrorCode: 0 } }
  let request
  const kkt = loadModule("src/lib/cloudkassir.ts", {
    mocks: { "@/lib/operator": { getOperatorInfo: async () => ({ inn: "0000000000" }) } },
    env: { CLOUDKASSIR_PUBLIC_ID: "test-public", CLOUDKASSIR_API_SECRET: "test-secret" },
    globals: { fetch: async (url, options) => { request = { url, options }; return Response.json(payload) } },
  })
  const input = { type: "Expense", items: [{ label: "Fixture", price: 80, amount: 80, quantity: 1, vat: null }], taxationSystem: 1, amountRub: 80, invoiceId: "payout" }
  assert.equal((await kkt.sendKktReceipt(input, "payout-receipt:payout")).receiptId, "receipt-id")
  assert.equal(request.options.headers["X-Request-ID"], "payout-receipt:payout")
  for (const invalid of [{}, { Success: true }, { Success: true, Model: { Id: "id", ErrorCode: -1 } }, { Success: false }]) {
    payload = invalid
    assert.equal((await kkt.sendKktReceipt(input, "payout-receipt:payout")).ok, false)
  }
  payload = { Success: true, Model: "Queued" }
  assert.equal(await kkt.getKktReceiptStatus("receipt-id"), "Queued")
  assert.match(request.url, /receipt\/status\/get$/)
  assert.equal(JSON.parse(request.options.body).Id, "receipt-id")
  payload = { Success: true, Model: "Processed" }
  assert.equal(await kkt.getKktReceiptStatus("receipt-id"), "Processed")
  payload = { Success: true, Model: "Anything" }
  await assert.rejects(() => kkt.getKktReceiptStatus("receipt-id"))
})

test("unknown receipt transport response is not reported as a fiscalized receipt", async () => {
  const kkt = loadModule("src/lib/cloudkassir.ts", {
    mocks: { "@/lib/operator": { getOperatorInfo: async () => ({ inn: "0000000000" }) } },
    env: { CLOUDKASSIR_PUBLIC_ID: "test", CLOUDKASSIR_API_SECRET: "test" },
    globals: { fetch: async () => { throw new Error("network reply lost") } },
  })
  const result = await kkt.sendKktReceipt({ type: "Expense", items: [], amountRub: 80, taxationSystem: 1 }, "fixed-request")
  assert.equal(result.ok, false)
  assert.equal(result.receiptId, undefined)
})
