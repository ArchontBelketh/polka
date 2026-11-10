import test from "node:test"
import assert from "node:assert/strict"
import { randomUUID, createHash } from "node:crypto"
import { loadModule } from "./helpers/load-module.mjs"
import { storeFixture } from "./helpers/store-fixture.mjs"

function fixture() {
  const store = storeFixture(), objects = new Map(), deleted = []
  let copies = 0, reads = 0, afterCopy
  store.seed("product", { id: "p", authorId: "owner" })
  const storage = {
    productSourceKey: (id, name) => `staging/products/${id}/source/${randomUUID()}/${name}`,
    productScreenshotUploadKey: (id, slot) => `staging/products/${id}/screenshot/${randomUUID()}/${slot}.png`,
    MAX_SCREENSHOT_BYTES: 5 * 1024 * 1024,
    getObjectBuffer: async key => { reads++; if (!objects.has(key)) throw new Error("missing upload"); return Buffer.from(objects.get(key)) },
    snapshotProductFile: async (id, body) => { const key = `products/${id}/artifacts/${++copies}/app.py`; objects.set(key, Buffer.from(body)); afterCopy?.(); return { key, fileSize: body.length, sha256: createHash("sha256").update(body).digest("hex") } },
    snapshotProductImage: async (id, body) => { const key = `products/${id}/images/${++copies}.png`; objects.set(key, Buffer.from(body)); return { key, fileSize: body.length, sha256: "image" } },
    deleteObject: async key => { deleted.push(key); objects.delete(key) },
  }
  const uploads = loadModule("src/lib/product-uploads.ts", { mocks: { "@/lib/db": { db: store.db }, "@/lib/s3": storage } })
  const input = { id: randomUUID(), productId: "p", type: "source", slot: 0, fileName: "app.py", fileSize: 4, contentType: "text/x-python" }
  return { ...store, ...uploads, input, objects, deleted, storage, copies: () => copies, reads: () => reads, afterCopy(fn) { afterCopy = fn } }
}

test("preparation records an attempt without registering a source file", async () => {
  const f = fixture()
  const first = await f.prepareProductUpload("owner", f.input)
  const retry = await f.prepareProductUpload("owner", f.input)
  assert.equal(first.stagingKey, retry.stagingKey)
  assert.equal(f.state().productUpload.length, 1)
  assert.equal(f.state().productFile.length, 0)
  assert.equal(f.copies(), 0)
})

test("preparation rejects changed metadata, purchased products and previous publications", async () => {
  const f = fixture()
  await f.prepareProductUpload("owner", f.input)
  await assert.rejects(f.prepareProductUpload("owner", { ...f.input, fileSize: 5 }), /другого файла/)
  f.seed("purchase", { productId: "p", buyerId: "buyer" })
  await assert.rejects(f.prepareProductUpload("owner", { ...f.input, id: randomUUID() }), /Базовые файлы/)
  const old = fixture(); old.state().product[0].publishedAt = new Date()
  await assert.rejects(old.prepareProductUpload("owner", old.input), /Базовые файлы/)
})

test("completion rejects missing bytes, wrong sizes and another owner without registering files", async () => {
  const f = fixture(), upload = await f.prepareProductUpload("owner", f.input)
  await assert.rejects(f.completeProductUpload("other", upload.id), /Нет доступа/)
  assert.equal(f.reads(), 0)
  await assert.rejects(f.completeProductUpload("owner", upload.id), /missing upload/)
  f.objects.set(upload.stagingKey, Buffer.from("wrong-size"))
  await assert.rejects(f.completeProductUpload("owner", upload.id), /размеру/)
  assert.equal(f.state().productFile.length, 0)
  assert.equal(f.state().productUpload[0].status, "PENDING")
})

test("confirmed source is immutable and repeated completion does not duplicate it", async () => {
  const f = fixture(), upload = await f.prepareProductUpload("owner", f.input)
  f.objects.set(upload.stagingKey, Buffer.from("code"))
  await f.completeProductUpload("owner", upload.id)
  const file = f.state().productFile[0]
  f.objects.set(upload.stagingKey, Buffer.from("evil"))
  await f.completeProductUpload("owner", upload.id)
  assert.equal(f.objects.get(file.s3Key).toString(), "code")
  assert.equal(f.state().productFile.length, 1)
  assert.equal(f.copies(), 1)
})

test("a lost commit response preserves the committed artifact and is resolved by a retry", async () => {
  const f = fixture(), upload = await f.prepareProductUpload("owner", f.input)
  f.objects.set(upload.stagingKey, Buffer.from("code")); f.control.commitError = true
  await assert.rejects(f.completeProductUpload("owner", upload.id), /uncertain commit/)
  assert.equal(f.deleted.length, 0)
  assert.equal(f.state().productUpload[0].status, "COMPLETED")
  await f.completeProductUpload("owner", upload.id)
  assert.equal(f.copies(), 1)
  assert.equal(f.objects.has(f.state().productFile[0].s3Key), true)
})

test("parallel completions keep one attachment and never delete the winning artifact", async () => {
  const f = fixture(), upload = await f.prepareProductUpload("owner", f.input)
  f.objects.set(upload.stagingKey, Buffer.from("code"))
  await Promise.all([f.completeProductUpload("owner", upload.id), f.completeProductUpload("owner", upload.id)])
  const file = f.state().productFile[0]
  assert.equal(f.state().productFile.length, 1)
  assert.ok(f.objects.has(file.s3Key))
  assert.ok(!f.deleted.includes(file.s3Key))
})

test("publication winning during a copy prevents late registration", async () => {
  const f = fixture(), upload = await f.prepareProductUpload("owner", f.input)
  f.objects.set(upload.stagingKey, Buffer.from("code"))
  f.afterCopy(() => { f.state().product[0].status = "PENDING" })
  await assert.rejects(f.completeProductUpload("owner", upload.id), /Состояние/)
  assert.equal(f.state().productFile.length, 0)
  assert.equal(f.deleted.length, 1)
  assert.ok(!f.deleted.includes(upload.stagingKey))
})

test("screenshots become visible only after completion and replace a slot instead of appending duplicates", async () => {
  const f = fixture()
  const upload = await f.prepareProductUpload("owner", { ...f.input, type: "screenshot", contentType: "image/png", fileName: "screen.png" })
  assert.equal(f.state().product[0].screenshots.length, 0)
  f.objects.set(upload.stagingKey, Buffer.from("data")); await f.completeProductUpload("owner", upload.id)
  await f.completeProductUpload("owner", upload.id)
  assert.equal(f.state().product[0].screenshots.length, 1)
})

test("cleanup defaults to dry-run, cancels stale attempts and only deletes staging objects", async () => {
  const f = fixture(), upload = await f.prepareProductUpload("owner", f.input)
  f.state().productUpload[0].updatedAt = new Date(0)
  f.objects.set(upload.stagingKey, Buffer.from("code"))
  const { cleanupProductUploads } = loadModule("src/lib/product-upload-cleanup.ts", { mocks: { "@/lib/db": { db: f.db }, "@/lib/s3": f.storage } })
  const plan = await cleanupProductUploads()
  assert.equal(plan.candidates, 1); assert.equal(f.deleted.length, 0)
  await cleanupProductUploads({ apply: true })
  assert.equal(f.state().productUpload[0].status, "CANCELLED")
  assert.deepEqual(f.deleted, [upload.stagingKey])
  await assert.rejects(f.completeProductUpload("owner", upload.id), /истёк/)
})

test("cleanup refuses artifact prefixes and skips attempts resumed after planning", async () => {
  const f = fixture(), upload = await f.prepareProductUpload("owner", f.input)
  f.state().productUpload[0].updatedAt = new Date(0)
  const { isOwnedStagingKey, cleanupProductUploads } = loadModule("src/lib/product-upload-cleanup.ts", { mocks: { "@/lib/db": { db: f.db }, "@/lib/s3": f.storage } })
  assert.equal(isOwnedStagingKey("p", "source", "products/p/artifacts/keep/app.py"), false)
  const original = f.db.$transaction
  f.db.$transaction = async work => { f.state().productUpload[0].updatedAt = new Date(); return original(work) }
  const result = await cleanupProductUploads({ apply: true })
  assert.equal(result.skipped, 1); assert.equal(f.deleted.length, 0)
})
