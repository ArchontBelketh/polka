import test from "node:test"
import assert from "node:assert/strict"
import { loadModule } from "./helpers/load-module.mjs"
import { storeFixture } from "./helpers/store-fixture.mjs"

function fixture() {
  const f = storeFixture()
  f.seed("user", { id: "seller", role: "DEVELOPER", email: null, telegramId: null, payoutProfile: { paymentLink: "https://pay.example.invalid/" } })
  f.seed("user", { id: "buyer", role: "BUYER", name: "Buyer", email: null, telegramId: null })
  f.seed("user", { id: "buyer-2", role: "BUYER", name: "Buyer 2" })
  f.seed("product", { id: "p", authorId: "seller", status: "APPROVED", price: 19929, title: "Synthetic", publishedAt: new Date() })
  f.seed("productFile", { id: "file", productId: "p", fileType: "SOURCE", s3Key: "products/p/artifacts/sealed/app.zip", fileName: "app.zip", fileSize: 10 })
  const actions = loadModule("src/lib/store-transactions.ts", { mocks: { "@/lib/db": { db: f.db } } })
  return { ...f, ...actions }
}

test("parallel direct-purchase requests create one awaiting payment with the database price", async () => {
  const f = fixture()
  const result = await Promise.all([f.requestDirectPurchase("buyer", "p"), f.requestDirectPurchase("buyer", "p")])
  assert.deepEqual(result.map(item => item.status).sort(), [201, 409])
  assert.equal(f.state().purchase.length, 1)
  assert.equal(f.state().purchase[0].amount, 19929)
  assert.equal(f.state().purchase[0].status, "AWAITING")
  assert.equal(f.control.operations[0], "product.updateMany")
})

test("own products, unpublished products and products without files cannot be bought", async () => {
  const f = fixture()
  assert.equal((await f.requestDirectPurchase("seller", "p")).status, 400)
  f.state().product[0].status = "PENDING"
  assert.equal((await f.requestDirectPurchase("buyer", "p")).status, 404)
  f.state().product[0].status = "APPROVED"; f.state().productFile = []
  assert.equal((await f.requestDirectPurchase("buyer", "p")).status, 409)
  assert.equal(f.state().purchase.length, 0)
})

test("an active dispute and an already paid purchase prevent a second purchase", async () => {
  for (const status of ["PENDING", "AWAITING", "PAID", "DELIVERED", "DISPUTED"]) {
    const f = fixture(); f.seed("purchase", { id: "existing", buyerId: "buyer", productId: "p", status })
    const result = await f.requestDirectPurchase("buyer", "p")
    assert.equal(result.status, 409); assert.equal(result.purchaseId, "existing")
    assert.equal(f.state().purchase.length, 1)
  }
})

test("waiting for manual payment grants neither download nor review permission", async () => {
  const f = fixture(), purchase = await f.requestDirectPurchase("buyer", "p")
  assert.equal((await f.saveVerifiedReview("buyer", "p", 5, "Synthetic review text")).status, 403)
  let signs = 0
  const { GET } = loadModule("src/app/api/download/[purchaseId]/route.ts", { env: { YANDEX_S3_ACCESS_KEY: "test", YANDEX_S3_SECRET_KEY: "test" }, mocks: {
    "@/lib/auth": { auth: async () => ({ user: { id: "buyer" } }) }, "@/lib/db": { db: f.db },
    "@/lib/s3": { getPresignedDownloadUrl: async () => { signs++; return "https://download.example.invalid/file" } },
  } })
  assert.equal((await GET({}, { params: Promise.resolve({ purchaseId: purchase.purchaseId }) })).status, 403)
  assert.equal(signs, 0)
})

test("request, author confirmation, sealed download and verified review work together in isolation", async () => {
  const f = fixture(), purchase = await f.requestDirectPurchase("buyer", "p")
  const { POST: confirm } = loadModule("src/app/api/purchases/[id]/confirm/route.ts", { mocks: {
    "@/lib/auth": { auth: async () => ({ user: { id: "seller" } }) }, "@/lib/db": { db: f.db },
    "@/lib/notify": { notifyListingPurchaseConfirmed: async () => {} },
  } })
  const context = { params: Promise.resolve({ id: purchase.purchaseId }) }
  const results = await Promise.all([confirm({}, context), confirm({}, context)])
  assert.equal(results.filter(result => result.status === 200).length, 1)
  assert.equal(f.state().product[0].salesCount, 1)
  const signed = []
  const { GET } = loadModule("src/app/api/download/[purchaseId]/route.ts", { env: { YANDEX_S3_ACCESS_KEY: "test", YANDEX_S3_SECRET_KEY: "test" }, mocks: {
    "@/lib/auth": { auth: async () => ({ user: { id: "buyer" } }) }, "@/lib/db": { db: f.db },
    "@/lib/s3": { getPresignedDownloadUrl: async (key) => { signed.push(key); return "https://download.example.invalid/file" } },
  } })
  const delivered = await GET({}, { params: Promise.resolve({ purchaseId: purchase.purchaseId }) })
  assert.equal(delivered.status, 302)
  assert.equal(delivered.headers.get("Cache-Control"), "private, no-store")
  assert.deepEqual(signed, ["products/p/artifacts/sealed/app.zip"])
  assert.equal((await f.saveVerifiedReview("buyer", "p", 5, "Confirmed synthetic purchase")).status, 201)
  assert.equal(f.state().product[0].rating, 5); assert.equal(f.state().product[0].reviewCount, 1)
  f.state().purchase[0].status = "REFUNDED"
  assert.equal((await GET({}, { params: Promise.resolve({ purchaseId: purchase.purchaseId }) })).status, 403)
  assert.equal((await f.saveVerifiedReview("buyer", "p", 1, "No longer eligible to edit")).status, 403)
  assert.equal(signed.length, 1)
})

test("parallel verified reviews and edits keep one row per author and accurate aggregates", async () => {
  const f = fixture()
  for (const id of ["buyer", "buyer-2"]) f.seed("purchase", { buyerId: id, productId: "p", status: "DELIVERED" })
  await Promise.all([f.saveVerifiedReview("buyer", "p", 5, "Synthetic review"), f.saveVerifiedReview("buyer-2", "p", 3, "Synthetic review")])
  assert.equal(f.state().product[0].rating, 4); assert.equal(f.state().product[0].reviewCount, 2)
  await Promise.all([f.saveVerifiedReview("buyer", "p", 1, "First update"), f.saveVerifiedReview("buyer", "p", 5, "Second update")])
  assert.equal(f.state().review.length, 2)
  assert.equal(f.state().product[0].rating, 4); assert.equal(f.state().product[0].reviewCount, 2)
  assert.equal((await f.saveVerifiedReview("seller", "p", 5, "Cannot review own product")).status, 403)
})

test("a refund winning while a download URL is prepared prevents issuing that URL", async () => {
  const f = fixture(); f.seed("purchase", { id: "paid", buyerId: "buyer", productId: "p", status: "DELIVERED" })
  const { GET } = loadModule("src/app/api/download/[purchaseId]/route.ts", { env: { YANDEX_S3_ACCESS_KEY: "test", YANDEX_S3_SECRET_KEY: "test" }, mocks: {
    "@/lib/auth": { auth: async () => ({ user: { id: "buyer" } }) }, "@/lib/db": { db: f.db },
    "@/lib/s3": { getPresignedDownloadUrl: async () => { f.state().purchase[0].status = "REFUNDED"; return "https://download.example.invalid/private" } },
  } })
  const result = await GET({}, { params: Promise.resolve({ purchaseId: "paid" }) })
  assert.equal(result.status, 403)
  assert.equal(result.headers.get("Location"), null)
  assert.equal(f.state().purchase[0].downloadCount, 0)
})
