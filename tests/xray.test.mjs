import test from "node:test"
import assert from "node:assert/strict"
import { promisify } from "node:util"
import { loadModule } from "./helpers/load-module.mjs"

function fixture({ fails = false, files = 1, unzipOk = true, malformed = false } = {}) {
  const execFile = () => {}
  execFile[promisify.custom] = async (_bin, argv) => {
    assert.equal(argv.length, 2)
    if (fails) throw new Error("Python unavailable")
    return { stdout: malformed ? "not JSON" : JSON.stringify({ language: "python", files_analyzed: files, files_skipped: [], parse_errors: [], facts: { internet: [], files: [], commands: [], secrets: [], suspicious: [] }, addresses: { urls: [], ips: [], flags: [] }, dependencies: { packages: [] } }) }
  }
  return loadModule("src/app/api/xray/route.ts", { mocks: {
    child_process: { execFile },
    fs: { mkdtempSync: () => "test-only-temp", mkdirSync() {}, writeFileSync() {}, rmSync() {}, existsSync: () => true },
    "@/lib/scanner/zip-safe": { safeUnzip: async () => ({ ok: unzipOk, extractedDir: "test-only-unzip" }) },
    "./osv": { checkOsv: async () => [] },
    "@/lib/ratelimit": { limits: { xray: () => true } },
    "@/lib/smartcaptcha": {},
  } })
}

const request = () => new Request("http://localhost/api/xray", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "print('test')" }) })

test("an unavailable analyzer returns 503 without a successful empty report", async () => {
  const response = await fixture({ fails: true }).POST(request())
  const body = await response.json()
  assert.equal(response.status, 503)
  assert.equal(body.ok, false)
  assert.equal(body.report, undefined)
})

test("invalid analyzer output cannot be presented as successful analysis", async () => {
  assert.equal((await fixture({ malformed: true }).POST(request())).status, 503)
})

test("zero analyzed files returns a meaningful input error", async () => {
  const response = await fixture({ files: 0 }).POST(request())
  assert.equal(response.status, 422)
  assert.equal((await response.json()).ok, false)
})

test("successful analysis still returns a report", async () => {
  const response = await fixture().POST(request())
  assert.equal(response.status, 200)
  assert.equal((await response.json()).report.files_analyzed, 1)
})

test("an archive rejected by the safety checks never produces a successful report", async () => {
  const response = await fixture({ unzipOk: false }).POST({
    headers: new Headers({ "content-type": "multipart/form-data" }),
    formData: async () => new Map([["file", { size: 2, name: "unsafe.zip", arrayBuffer: async () => new Uint8Array([0x50, 0x4b]).buffer }]]),
  })
  assert.equal(response.status, 422)
  assert.equal((await response.json()).report, undefined)
})
