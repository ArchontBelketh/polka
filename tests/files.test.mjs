import test from "node:test"
import assert from "node:assert/strict"
import { loadModule } from "./helpers/load-module.mjs"

function storageFixture() {
  const objects = new Map()
  let reads = 0
  class Put { constructor(input) { this.input = input } }
  class Get { constructor(input) { this.input = input } }
  const s3 = loadModule("src/lib/s3.ts", { mocks: {
    "@aws-sdk/client-s3": {
      PutObjectCommand: Put, GetObjectCommand: Get, DeleteObjectCommand: class {},
      S3Client: class {
        async send(cmd) {
          if (cmd instanceof Put) { objects.set(cmd.input.Key, Buffer.from(cmd.input.Body)); return {} }
          if (cmd instanceof Get) { reads++; const body = objects.get(cmd.input.Key); return { Body: (async function* () { yield body })() } }
        }
      },
    },
    "@aws-sdk/s3-request-presigner": { getSignedUrl: async () => "test-only-upload-url" },
  } })
  return { s3, objects, reads: () => reads }
}

function versionFixture() {
  const storage = storageFixture()
  let created
  const { POST } = loadModule("src/app/api/products/[id]/versions/route.ts", { mocks: {
    "@/lib/auth": { auth: async () => ({ user: { id: "author-1" } }) },
    "@/lib/s3": storage.s3,
    "@/lib/db": { db: {
      product: { findUnique: async () => ({ id: "product-1", authorId: "author-1", status: "APPROVED" }) },
      productVersion: { findFirst: async () => null, create: async ({ data }) => { created = { id: "version-1", ...data }; return created } },
    } },
  } })
  return { ...storage, created: () => created, register: (data) => POST(new Request("http://localhost/api/products/product-1/versions", { method: "POST", body: JSON.stringify({ version: "2.0.0", ...data }) }), { params: Promise.resolve({ id: "product-1" }) }) }
}

test("version registration seals the uploaded bytes and keeps the version in the review queue", async () => {
  const f = versionFixture()
  const key = f.s3.productVersionUploadKey("product-1", "app.py")
  const original = Buffer.from("original version")
  f.objects.set(key, original)
  const response = await f.register({ s3Key: key, fileName: "app.py", fileSize: original.length })
  assert.equal(response.status, 201)
  assert.equal(f.created().status, "PENDING")
  assert.match(f.created().s3Key, /^products\/product-1\/artifacts\//)
  f.objects.set(key, Buffer.from("changed staging object"))
  assert.equal((await f.s3.getObjectBuffer(f.created().s3Key)).toString(), original.toString())
})

test("the version API rejects another product's key before reading storage", async () => {
  const f = versionFixture()
  const response = await f.register({ s3Key: f.s3.productVersionUploadKey("product-2", "app.py"), fileName: "app.py", fileSize: 3 })
  assert.equal(response.status, 422)
  assert.equal(f.reads(), 0)
  assert.equal(f.created(), undefined)
})

test("uploads of an identical filename get independent staging keys", () => {
  const { s3 } = storageFixture()
  assert.notEqual(s3.productSourceKey("product-1", "app.zip"), s3.productSourceKey("product-1", "app.zip"))
  assert.match(s3.productSourceKey("product-1", "app.zip"), /^staging\/products\/product-1\/source\//)
})

test("reusing an upload URL cannot change a snapshot that was sent for review", async () => {
  const { s3, objects } = storageFixture()
  const key = s3.productVersionUploadKey("product-1", "app.py")
  objects.set(key, Buffer.from("original reviewed code"))
  const snapshot = await s3.snapshotProductFile("product-1", await s3.getObjectBuffer(key), "app.py")
  objects.set(key, Buffer.from("replacement after review"))
  assert.match(snapshot.key, /^products\/product-1\/artifacts\//)
  assert.equal((await s3.getObjectBuffer(snapshot.key)).toString(), "original reviewed code")
  assert.equal(snapshot.sha256.length, 64)
})

test("version registration rejects another product and already published artifact keys", () => {
  const { s3 } = storageFixture()
  const key = s3.productVersionUploadKey("product-1", "app.py")
  assert.equal(s3.isProductVersionUploadKey(key, "product-1", "app.py"), true)
  assert.equal(s3.isProductVersionUploadKey(key, "product-2", "app.py"), false)
  assert.equal(s3.isProductVersionUploadKey(key, "product-1", "different.py"), false)
  assert.equal(s3.isProductVersionUploadKey("products/product-1/artifacts/hash/app.py", "product-1", "app.py"), false)
})

test("scanning reuses a matching sealed source and reseals changed bytes", async () => {
  const { s3, objects } = storageFixture()
  const buffer = Buffer.from("source")
  const snapshot = await s3.snapshotProductFile("product-1", buffer, "app.py")
  const file = { s3Key: snapshot.key, sha256: snapshot.sha256, fileName: "app.py", fileSize: buffer.length }
  const count = objects.size
  assert.equal((await s3.sealProductSource("product-1", file, buffer)).key, snapshot.key)
  assert.equal(objects.size, count)
  const changed = await s3.sealProductSource("product-1", file, Buffer.from("change"))
  assert.notEqual(changed.key, snapshot.key)
  assert.equal(objects.get(snapshot.key).toString(), "source")
})

test("size limits are enforced while reading actual bytes, not just client metadata", async () => {
  const { s3, objects } = storageFixture()
  objects.set("oversized", Buffer.from("12345"))
  await assert.rejects(s3.getObjectBuffer("oversized", 4), /size limit/)
})

test("filenames cannot introduce path separators or shell metacharacters", () => {
  const { s3 } = storageFixture()
  const safe = s3.sanitizeFileName('../"`$file;test.py.py')
  assert.doesNotMatch(safe, /[\\/"`$;]/)
  assert.equal(safe.endsWith(".py.py"), false)
})

for (const status of ["APPROVED", "PENDING", "SUSPENDED"]) {
  test(`source upload cannot modify a ${status} product`, async () => {
    let writes = 0
    const { POST } = loadModule("src/app/api/upload/route.ts", {
      env: { NODE_ENV: "production", YANDEX_S3_ACCESS_KEY: "test", YANDEX_S3_SECRET_KEY: "test" },
      mocks: {
        "@/lib/current-user": { getCurrentUser: async () => ({ id: "author-1", role: "DEVELOPER" }) },
        "@/lib/db": { db: { product: { findUnique: async () => ({ id: "product-1", authorId: "author-1", status }) }, productFile: { create: async () => { writes++ } } } },
        "@/lib/s3": { sanitizeFileName: (name) => name },
        "@/lib/ratelimit": { limits: { upload: () => true } },
      },
    })
    const response = await POST(new Request("http://localhost/api/upload", { method: "POST", body: JSON.stringify({ productId: "product-1", type: "source", fileName: "app.py", fileSize: 5, contentType: "text/x-python" }) }))
    assert.equal(response.status, 409)
    assert.equal(writes, 0)
  })
}
