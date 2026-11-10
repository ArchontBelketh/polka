import test from "node:test"
import assert from "node:assert/strict"
import { loadModule } from "./helpers/load-module.mjs"
import { storeFixture } from "./helpers/store-fixture.mjs"

function fixture() {
  const f = storeFixture()
  return { ...f, ...loadModule("src/lib/product-submissions.ts", { mocks: { "@/lib/db": { db: f.db } } }) }
}
const data = { authorId: "owner", title: "Synthetic draft", slug: "synthetic" }

test("parallel submissions share one product and roll back the losing unkeyed draft", async () => {
  const f = fixture()
  const result = await Promise.all([f.createProductSubmission("owner", "submission", "hash", data), f.createProductSubmission("owner", "submission", "hash", data)])
  assert.equal(result[0].product.id, result[1].product.id)
  assert.equal(f.state().product.length, 1); assert.equal(f.state().productSubmission.length, 1)
})

test("lost creation replies resolve the committed product without another write", async () => {
  const f = fixture(); f.control.commitError = true
  const created = await f.createProductSubmission("owner", "submission", "hash", data)
  const retry = await f.createProductSubmission("owner", "submission", "hash", data)
  assert.equal(created.product.id, retry.product.id)
  assert.equal(f.state().product.length, 1)
})

test("retry tokens never overwrite a changed payload or expose another owner's draft", async () => {
  const f = fixture(), saved = await f.createProductSubmission("owner", "submission", "hash", data)
  await assert.rejects(f.createProductSubmission("owner", "submission", "changed", data), error => error.productId === saved.product.id)
  await assert.rejects(f.createProductSubmission("other", "submission", "hash", data), error => error.productId === undefined)
  assert.equal(f.state().product.length, 1)
  const { submissionFingerprint } = loadModule("src/lib/submission-fingerprint.ts")
  assert.equal(submissionFingerprint({ b: [2], a: 1 }), submissionFingerprint({ a: 1, b: [2] }))
})

test("file retries reuse the same upload token and recover a lost completion reply", async () => {
  const calls = [], file = { name: "app.py", type: "text/x-python", size: 4 }
  let confirmed = false
  const { uploadProductFile } = loadModule("src/lib/product-upload.ts", { globals: { fetch: async (url, init) => {
    calls.push({ url, body: init.body })
    if (url === "/api/upload") { const input = JSON.parse(init.body); return Response.json(confirmed ? { completed: true, uploadId: input.uploadId } : { url: "https://storage.example.invalid/file", uploadId: input.uploadId }) }
    if (url.startsWith("/api/upload/")) { confirmed = true; throw new Error("lost completion reply") }
    return new Response("", { status: 200 })
  } } })
  await assert.rejects(uploadProductFile("p", file, "source"), /lost completion reply/)
  await uploadProductFile("p", file, "source")
  const preparations = calls.filter(call => call.url === "/api/upload").map(call => JSON.parse(call.body))
  assert.equal(preparations[0].uploadId, preparations[1].uploadId)
  assert.equal(calls.filter(call => call.url.startsWith("https:")).length, 1)
})
