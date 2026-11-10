import test from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { loadModule } from "./helpers/load-module.mjs"
import { storeFixture } from "./helpers/store-fixture.mjs"

function fixture({ configured = true } = {}) {
  const f = storeFixture({ serializeWrites: true }), objects = new Map(), puts = [], signed = []
  for (const [id, role] of [["customer", "BUYER"], ["executor", "DEVELOPER"], ["outsider", "DEVELOPER"], ["staff", "MODERATOR"]]) f.seed("user", { id, role })
  f.seed("job", { id: "job", customerId: "customer", publicationStatus: "APPROVED", status: "IN_PROGRESS" })
  f.seed("jobContract", { jobId: "job", customerId: "customer", developerId: "executor" })
  const command = type => class { constructor(input) { this.type = type; this.input = input } }
  const s3 = { PutObjectCommand: command("put"), GetObjectCommand: command("get"), DeleteObjectCommand: command("delete"), S3Client: class {
    async send(value) {
      assert.equal(f.control.inTransaction, false)
      if (value.type === "put") { puts.push(value.input.Key); objects.set(value.input.Key, Buffer.from(value.input.Body)); return {} }
      if (value.type === "delete") { objects.delete(value.input.Key); return {} }
      throw new Error("unexpected storage call")
    }
  } }
  const files = loadModule("src/lib/jobs/files.ts", { env: configured ? { YANDEX_S3_PRIVATE_BUCKET: "private-fixture", YANDEX_S3_ACCESS_KEY: "fixture-key", YANDEX_S3_SECRET_KEY: "fixture-secret" } : {}, mocks: {
    "@/lib/db": { db: f.db }, "@aws-sdk/client-s3": s3,
    "@aws-sdk/s3-request-presigner": { getSignedUrl: async (_client, cmd, options) => { signed.push({ ...cmd.input, options }); return "https://private.example.invalid/signed" } },
  } })
  return { ...f, ...files, objects, puts, signed }
}
const actor = { id: "executor", role: "DEVELOPER" }
const body = (text = "source code") => new Request("http://localhost/upload", { method: "POST", body: text })

test("job attachments are stored in a private bucket and expose only safe metadata", async () => {
  const f = fixture(), id = randomUUID()
  const file = await f.uploadJobAttachment(actor, "job", id, "пример.py", body())
  assert.equal(file.id, id)
  assert.equal(f.state().jobAttachment.length, 1)
  assert.equal(f.objects.size, 1)
  assert.doesNotMatch(JSON.stringify(file), /s3Key|sha256|Bucket|fixture-secret/)
  await f.downloadJobAttachment({ id: "customer", role: "BUYER" }, "job", id)
  assert.equal(f.signed[0].Bucket, "private-fixture")
  assert.equal(f.signed[0].ResponseContentType, "application/octet-stream")
  assert.match(f.signed[0].ResponseContentDisposition, /^attachment;/)
  assert.equal(f.signed[0].options.expiresIn, 120)
})

test("parallel identical file retries retain the referenced copy and remove only unused copies", async () => {
  const f = fixture(), id = randomUUID()
  const files = await Promise.all([0, 1].map(() => f.uploadJobAttachment(actor, "job", id, "app.py", body())))
  assert.equal(files[0].id, files[1].id)
  assert.equal(f.state().jobAttachment.length, 1)
  assert.equal(new Set(f.puts).size, f.puts.length)
  assert.equal(f.objects.size, 1)
  assert.ok(f.objects.has(f.state().jobAttachment[0].s3Key))
})

test("lost attachment commit reply preserves the file and retry returns the existing result", async () => {
  const f = fixture(), id = randomUUID(); f.control.commitError = true
  await assert.rejects(() => f.uploadJobAttachment(actor, "job", id, "app.py", body()), /uncertain commit/)
  assert.equal(f.objects.size, 1)
  await f.uploadJobAttachment(actor, "job", id, "app.py", body())
  assert.equal(f.objects.size, 1)
  assert.equal(f.puts.length, 1)
  await assert.rejects(() => f.uploadJobAttachment(actor, "job", id, "app.py", body("different source")), /использована/)
})

test("outsiders cannot list or download a private order file", async () => {
  const f = fixture(), id = randomUUID()
  await f.uploadJobAttachment(actor, "job", id, "app.py", body())
  await assert.rejects(() => f.downloadJobAttachment({ id: "outsider", role: "DEVELOPER" }, "job", id), /не найдена/)
  await assert.rejects(() => f.uploadJobAttachment({ id: "outsider", role: "DEVELOPER" }, "job", randomUUID(), "foreign.py", body()), /не найдена/)
  assert.equal(f.signed.length, 0)
  await f.downloadJobAttachment({ id: "staff", role: "MODERATOR" }, "job", id)
  assert.equal(f.signed.length, 1)
})

test("unconfigured storage never registers a fictitious attachment", async () => {
  const f = fixture({ configured: false })
  await assert.rejects(() => f.uploadJobAttachment(actor, "job", randomUUID(), "app.py", body()), /недоступен/)
  assert.equal(f.state().jobAttachment.length, 0)
  assert.equal(f.puts.length, 0)
})

test("moderator suspension blocks participant downloads while preserving staff inspection", async () => {
  const f = fixture(), id = randomUUID()
  await f.uploadJobAttachment(actor, "job", id, "app.py", body())
  f.state().job[0].publicationStatus = "SUSPENDED"
  await assert.rejects(() => f.downloadJobAttachment({ id: "customer", role: "BUYER" }, "job", id), error => error.status === 403)
  assert.equal(f.signed.length, 0)
  await f.downloadJobAttachment({ id: "staff", role: "MODERATOR" }, "job", id)
  assert.equal(f.signed.length, 1)
})

test("stream size limits stop reading oversized bodies even without Content-Length", async () => {
  const f = fixture(); let cancelled = false
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(10 * 1024 * 1024)); controller.enqueue(new Uint8Array(1)) }, cancel() { cancelled = true } })
  const request = new Request("http://localhost/upload", { method: "POST", body: stream, duplex: "half" })
  await assert.rejects(() => f.readBoundedBody(request), error => error.status === 413)
  assert.equal(cancelled, true)
  assert.equal(f.puts.length, 0)
})

test("completion and file caps reject new uploads without changing earlier attachments", async () => {
  const f = fixture()
  f.state().job[0].status = "COMPLETED"
  await assert.rejects(() => f.uploadJobAttachment(actor, "job", randomUUID(), "app.py", body()), /нельзя/)
  f.state().job[0].status = "IN_PROGRESS"
  for (let i = 0; i < 50; i++) f.seed("jobAttachment", { id: randomUUID(), jobId: "job", authorId: "customer" })
  await assert.rejects(() => f.uploadJobAttachment(actor, "job", randomUUID(), "app.py", body()), /лимит/)
  assert.equal(f.state().jobAttachment.length, 50)
  assert.equal(f.objects.size, 0)
})
