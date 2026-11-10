import test from "node:test"
import assert from "node:assert/strict"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { loadModule } from "./helpers/load-module.mjs"

const value = () => ({ languages: ["PYTHON"], platforms: ["WINDOWS", "LINUX"], compatibility: "Python 3.12", outcome: "Исходный код и пример", supportTerms: "Помощь с установкой", updateTerms: "Исправления текущей версии" })
const req = (body) => new Request("http://localhost/api/products/p/specification", { method: "PUT", body: JSON.stringify(body) })
const params = { params: Promise.resolve({ id: "p" }) }

function fixture({ user = { id: "owner", role: "DEVELOPER" }, owner = "owner", status = "DRAFT", failure = false } = {}) {
  const writes = []
  const { PUT } = loadModule("src/app/api/products/[id]/specification/route.ts", { mocks: {
    "@/lib/current-user": { getCurrentUser: async () => user },
    "@/lib/db": { db: {
      product: { findUnique: async () => ({ authorId: owner }) },
      $transaction: async (fn) => fn({
        product: { updateMany: async ({ where }) => {
          assert.equal(where.authorId, "owner"); assert.equal(where.id, "p")
          return { count: where.status.in.includes(status) ? 1 : 0 }
        } },
        productSpecification: { upsert: async (args) => { if (failure) throw new Error("write failed"); writes.push(args) } },
      }),
    } },
  } })
  return { PUT: (body) => PUT(req(body), params), writes }
}

test("specification editing requires the active developer who owns the product", async () => {
  for (const [options, status] of [[{ user: null }, 401], [{ user: { id: "owner", role: "BUYER" } }, 403], [{ owner: "someone-else" }, 403]]) {
    const f = fixture(options)
    assert.equal((await f.PUT(value())).status, status)
    assert.equal(f.writes.length, 0)
  }
})

test("author edits cannot race publication or modify a published or suspended product", async () => {
  for (const status of ["PENDING", "APPROVED", "SUSPENDED"]) {
    const f = fixture({ status })
    assert.equal((await f.PUT(value())).status, 409)
    assert.equal(f.writes.length, 0)
  }
  for (const status of ["DRAFT", "REJECTED", "SCAN_FAILED"]) assert.equal((await fixture({ status }).PUT(value())).status, 200)
})

test("specification requests cannot change product identity, prices, status or file keys", async () => {
  for (const key of ["productId", "authorId", "price", "status", "s3Key", "license"]) {
    const f = fixture()
    assert.equal((await f.PUT({ ...value(), [key]: "forged" })).status, 422)
    assert.equal(f.writes.length, 0)
  }
})

test("specification updates normalize declarations and allow deliberately clearing optional information", async () => {
  const f = fixture()
  assert.equal((await f.PUT({ ...value(), languages: ["PYTHON", "PYTHON"] })).status, 200)
  assert.equal(f.writes[0].where.productId, "p")
  assert.deepEqual(Array.from(f.writes[0].update.languages), ["PYTHON"])
  assert.equal((await f.PUT({})).status, 200)
  assert.equal(f.writes[1].update.compatibility, null)
  assert.equal(f.writes[1].update.supportTerms, null)
})

test("unrecognized languages, oversized terms and overlong language lists are rejected", async () => {
  for (const change of [{ languages: ["unknown"] }, { platforms: ["unknown"] }, { languages: Array(6).fill("PYTHON") }, { supportTerms: "x".repeat(2001) }]) assert.equal((await fixture().PUT({ ...value(), ...change })).status, 422)
})

const productBody = () => ({ title: "Новый продукт", shortDesc: "Описание продукта для теста", fullDesc: "Достаточно подробное описание тестового продукта", category: "AUTOMATION", price: 15000, features: ["Функция"], installGuide: "Инструкция ".repeat(30), license: "team" })

test("new product creation keeps the session owner and stores optional specifications in the same nested write", async () => {
  let saved
  const { POST } = loadModule("src/app/api/products/route.ts", { mocks: {
    "@/lib/current-user": { getCurrentUser: async () => ({ id: "owner", role: "DEVELOPER" }) },
    "@/lib/auth": {}, "@/lib/slugify": { slugify: () => "stable-url" },
    "@/lib/db": { db: { product: { create: async ({ data }) => { saved = data; return { id: "p", ...data } } } } },
  } })
  const response = await POST(req({ ...productBody(), specification: value() }))
  assert.equal(response.status, 201)
  assert.equal(saved.authorId, "owner")
  assert.equal(saved.status, "DRAFT")
  assert.equal(saved.specification.create.platforms.length, 2)
  assert.equal(saved.slug, "stable-url")
  assert.equal((await POST(req({ ...productBody(), status: "APPROVED" }))).status, 422)
})

test("staff corrections preserve public URLs and commit the product, specification and audit together", async () => {
  const order = []
  let update
  const { PATCH } = loadModule("src/app/api/products/[id]/route.ts", { mocks: {
    "@/lib/current-user": { getCurrentUser: async () => ({ id: "mod", role: "MODERATOR" }) },
    "@/lib/auth": {}, "@/lib/s3": {},
    "@/lib/db": { db: {
      product: { findUnique: async () => ({ id: "p", slug: "original-url", title: "Old title", price: 15000, category: "AUTOMATION", saleModel: null }) },
      $transaction: async (fn) => { order.push("begin"); const result = await fn({
        product: { update: async ({ data }) => { update = data; order.push("product"); return { slug: "original-url" } } },
        productSpecification: { upsert: async () => { order.push("specification") } },
        moderationLog: { create: async () => { order.push("audit") } },
      }); order.push("commit"); return result },
    } },
  } })
  const response = await PATCH(req({ ...productBody(), specification: value() }), params)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).slug, "original-url")
  assert.ok(!Object.hasOwn(update, "slug"))
  assert.deepEqual(order, ["begin", "product", "specification", "audit", "commit"])
})

test("legacy cards show unknown support and compatibility without inventing conditions", () => {
  const { ProductSpecifications } = loadModule("src/components/product/ProductSpecifications.tsx")
  const html = renderToStaticMarkup(createElement(ProductSpecifications, { specification: null }))
  assert.match(html, /Условия поддержки не указаны/)
  assert.match(html, /Условия предоставления обновлений не указаны/)
  assert.doesNotMatch(html, /бесплатн|гаранти|пожизненн/i)
})

test("file transfer failures are propagated and never reported as successful uploads", async () => {
  const file = { name: "code.zip", size: 10, type: "application/zip" }
  for (const [presign, upload, expected] of [
    [new Response('{"error":"denied"}', { status: 403 }), null, /denied/],
    [Response.json({ uploadId: "test-upload", url: null }), null, /Хранилище/],
    [Response.json({ uploadId: "test-upload", url: "https://storage.example.invalid/upload" }), new Response("", { status: 500 }), /Файл не загрузился/],
  ]) {
    const calls = []
    const { uploadProductFile } = loadModule("src/lib/product-upload.ts", { globals: { fetch: async (url) => { calls.push(url); return calls.length === 1 ? presign : upload } } })
    await assert.rejects(uploadProductFile("p", file, "source"), expected)
    assert.equal(calls.length, upload ? 2 : 1)
  }
})

test("product structured data escapes script terminators and never falls back to a private email", async () => {
  const dangerous = "</script><script>alert(1)</script>"
  const product = {
    id: "p", slug: "stable", title: dangerous, shortDesc: dangerous, fullDesc: "Описание", status: "APPROVED", category: "WEB", price: 100,
    authorId: "owner", author: { id: "owner", name: null, email: "private@example.invalid", payoutProfile: null },
    screenshots: [], files: [], features: [], requirements: [], techStack: [], specification: null, license: "personal",
    rating: 0, reviewCount: 0, salesCount: 0, manuallyVerified: false, installGuide: null,
  }
  let projection
  const noop = () => null
  const { default: ProductPage } = loadModule("src/app/product/[slug]/page.tsx", { mocks: {
    "@/lib/auth": { auth: async () => null }, "@/lib/s3": {},
    "@/lib/db": { db: { product: { findUnique: async (args) => { projection = args; return product } } } },
    "@/components/product/BuyPanel": { BuyPanel: ({ authorName }) => createElement("p", null, authorName) },
    "@/components/product/AuthorCard": { AuthorCard: noop }, "@/components/product/XrayPassportBlock": {},
    "@/components/product/ReviewList": { ReviewList: noop }, "@/components/product/ReviewForm": {},
    "@/components/product/ScreenshotSlider": { ScreenshotSlider: noop }, "@/components/product/AiReviewOrder": {},
    "@/components/product/QASection": { QASection: noop }, "@/components/ui/Markdown": { Markdown: ({ content }) => createElement("p", null, content) },
  } })
  const html = renderToStaticMarkup(await ProductPage({ params: Promise.resolve({ slug: "stable" }) }))
  assert.ok(!html.includes(dangerous))
  assert.ok(html.includes("\\u003c/script>"))
  assert.ok(!html.includes("private@example.invalid"))
  assert.ok(!Object.hasOwn(projection.include.author.select, "email"))
})
