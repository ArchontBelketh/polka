import test from "node:test"
import assert from "node:assert/strict"
import { loadModule } from "./helpers/load-module.mjs"
import { storeFixture } from "./helpers/store-fixture.mjs"

test("scan waits for a confirmed source and starts once after successful registration", async () => {
  const f = storeFixture(); let scans = 0
  f.seed("user", { id: "owner", role: "DEVELOPER" })
  f.seed("product", { id: "p", authorId: "owner", price: 10000 })
  f.db.payoutProfile = { findUnique: async () => ({}) }
  const { POST } = loadModule("src/app/api/scan/route.ts", { mocks: {
    "@/lib/auth": { auth: async () => ({ user: { id: "owner" } }) }, "@/lib/db": { db: f.db },
    "@/lib/payout-profile": { canPublish: () => true }, "@/lib/scanner": { runScan: async () => { scans++ } },
  } })
  const request = { nextUrl: new URL("http://localhost/api/scan?productId=p") }
  assert.equal((await POST(request)).status, 422)
  assert.equal(f.state().product[0].status, "DRAFT"); assert.equal(scans, 0)
  f.seed("productFile", { productId: "p", fileType: "SOURCE", sha256: "a".repeat(64), s3Key: "products/p/artifacts/hash/app.py" })
  assert.equal((await POST(request)).status, 202)
  const repeated = await POST(request)
  assert.equal(repeated.status, 409)
  assert.equal((await repeated.json()).code, "ALREADY_SUBMITTED")
  assert.equal(scans, 1)
})

test("unconfigured storage never creates a fake local source row", async () => {
  const f = storeFixture(); f.seed("product", { id: "p", authorId: "owner" })
  const { POST } = loadModule("src/app/api/upload/route.ts", { mocks: {
    "@/lib/current-user": { getCurrentUser: async () => ({ id: "owner", role: "DEVELOPER" }) },
    "@/lib/db": { db: f.db }, "@/lib/s3": { sanitizeFileName: value => value },
    "@/lib/ratelimit": { limits: { upload: () => true } },
  } })
  const response = await POST(new Request("http://localhost/api/upload", { method: "POST", body: JSON.stringify({ productId: "p", type: "source", fileName: "app.py", fileSize: 4, contentType: "text/x-python" }) }))
  assert.equal(response.status, 503)
  assert.equal(f.state().productFile.length, 0); assert.equal(f.state().productUpload.length, 0)
})

test("upload completion rejects a guest before reading any upload record", async () => {
  const { POST } = loadModule("src/app/api/upload/[id]/complete/route.ts", { mocks: {
    "@/lib/current-user": { getCurrentUser: async () => null }, "@/lib/product-uploads": {},
    "@/lib/ratelimit": { limits: {} },
  } })
  assert.equal((await POST({}, { params: Promise.resolve({ id: "foreign" }) })).status, 401)
})

test("submission recovery does not disclose another user's product ID", async () => {
  const f = storeFixture(); f.seed("productSubmission", { id: "submission", userId: "owner", productId: "private" })
  const { GET } = loadModule("src/app/api/product-submissions/[id]/route.ts", { mocks: {
    "@/lib/current-user": { getCurrentUser: async () => ({ id: "other" }) }, "@/lib/db": { db: f.db },
  } })
  const response = await GET({}, { params: Promise.resolve({ id: "submission" }) })
  assert.equal(response.status, 404)
  assert.ok(!(await response.text()).includes("private"))
})

test("draft deletion rechecks publication and purchases inside the transaction", async () => {
  const f = storeFixture(); f.seed("product", { id: "p", authorId: "owner" })
  f.seed("productUpload", { productId: "p", stagingKey: "staging/products/p/source/attempt/app.py", artifactKey: "products/p/artifacts/keep/app.py" })
  const { deleteProductDraft } = loadModule("src/lib/product-draft-delete.ts", { mocks: { "@/lib/db": { db: f.db } } })
  f.state().product[0].publishedAt = new Date()
  assert.equal(await deleteProductDraft("p", "owner"), null)
  f.state().product[0].publishedAt = null; f.seed("purchase", { productId: "p" })
  assert.equal(await deleteProductDraft("p", "owner"), null)
  f.state().purchase = []
  const keys = await deleteProductDraft("p", "owner")
  assert.ok(keys.includes("staging/products/p/source/attempt/app.py"))
  assert.ok(keys.includes("products/p/artifacts/keep/app.py"))
  assert.equal(f.state().product.length, 0)
})
