import test from "node:test"
import assert from "node:assert/strict"
import { loadModule } from "./helpers/load-module.mjs"

const catalog = loadModule("src/lib/catalog-query.ts")
const query = (input = {}) => {
  const parsed = catalog.parseCatalogQuery(input)
  assert.equal(parsed.success, true)
  return parsed.value
}

test("catalog prices are parsed exactly in kopecks, including comma decimals and zero", () => {
  for (const [value, expected] of [["0", 0], ["0,29", 29], ["1.01", 101], ["1000.5", 100050], ["21474836.47", 2147483647]]) assert.equal(catalog.priceInKopecks(value), expected)
  for (const value of ["NaN", "Infinity", "-1", "1e6", "12x", "1.001", "21474836.48", "999999999999"]) assert.equal(catalog.priceInKopecks(value), null)
})

test("invalid, duplicated and reversed filters are rejected before querying a database", () => {
  for (const input of [{ category: "HIDDEN" }, { platform: "ADMIN" }, { language: "unknown" }, { sort: "random" }, { page: "-1" }, { page: "NaN" }, { page: "10001" }, { q: "x".repeat(201) }, { minPrice: "20", maxPrice: "10" }, { q: ["a", "b"] }, new URLSearchParams("language=PYTHON&language=JAVA")]) assert.equal(catalog.parseCatalogQuery(input).success, false)
})

test("catalog pagination and category links preserve every active filter", () => {
  const current = query({ category: "EXCEL", q: "сводный отчёт", sort: "price_asc", minPrice: "0,29", maxPrice: "1500", language: "VBA", platform: "WINDOWS", compatibility: "Excel 2021", license: "commercial", page: "3" })
  const next = new URL(catalog.catalogUrl(current, { page: 4 }), "http://localhost")
  assert.equal(next.searchParams.get("page"), "4")
  assert.equal(next.searchParams.get("q"), "сводный отчёт")
  for (const key of ["language", "platform", "compatibility", "license", "category", "sort", "maxPrice"]) assert.equal(next.searchParams.get(key), current[key])
  assert.equal(next.searchParams.get("minPrice"), "0.29")
  const category = new URL(catalog.catalogUrl(current, { category: "AUTOMATION", page: 1 }), "http://localhost")
  assert.equal(category.searchParams.get("language"), "VBA")
  assert.equal(category.searchParams.get("page"), null)
  assert.equal(catalog.catalogUrl(query()), "/catalog")
})

test("unfiltered catalog retains legacy products while declared filters constrain the specification", () => {
  const base = catalog.catalogWhere(query())
  assert.equal(base.status, "APPROVED")
  assert.equal(base.specification, undefined)
  const filtered = catalog.catalogWhere(query({ language: "PYTHON", platform: "LINUX", compatibility: "3.12", minPrice: "0" }))
  assert.equal(filtered.specification.is.languages.has, "PYTHON")
  assert.equal(filtered.specification.is.platforms.has, "LINUX")
  assert.equal(filtered.specification.is.compatibility.contains, "3.12")
  assert.equal(filtered.price.gte, 0)
  const order = catalog.catalogOrderBy(query({ sort: "price_asc" }))
  assert.equal(order[0].price, "asc")
  assert.equal(order.at(-1).id, "asc")
})

test("commercial license filtering includes legacy team licenses without treating unknown licenses as personal", () => {
  assert.deepEqual(Array.from(catalog.catalogWhere(query({ license: "commercial" })).license.in), ["commercial", "team"])
  assert.equal(catalog.catalogWhere(query({ license: "personal" })).license, "personal")
  const { licenseText } = loadModule("src/lib/licenses.ts")
  assert.equal(licenseText("team"), licenseText("commercial"))
  assert.doesNotMatch(licenseText("MIT"), /Личная лицензия/)
})

function apiFixture({ role, failure = false } = {}) {
  const calls = []
  const { GET } = loadModule("src/app/api/products/route.ts", { mocks: {
    "@/lib/current-user": {},
    "@/lib/slugify": {},
    "@/lib/auth": { auth: async () => role ? { user: { id: "reader", role } } : null },
    "@/lib/db": { db: { product: {
      findMany: async (args) => { calls.push(args); if (failure) throw new Error("offline"); return [] },
      count: async () => 0,
    } } },
  } })
  return { GET: (params = "") => GET({ nextUrl: new URL(`http://localhost/api/products?${params}`) }), calls }
}

test("catalog API uses the same validated filters as the page and never exposes drafts to guests", async () => {
  const fixture = apiFixture()
  const response = await fixture.GET("status=DRAFT&language=PYTHON&platform=LINUX&minPrice=0.29&license=commercial&sort=price_asc&page=2&limit=5")
  assert.equal(response.status, 200)
  assert.equal(fixture.calls[0].where.status, "APPROVED")
  assert.equal(fixture.calls[0].where.specification.is.languages.has, "PYTHON")
  assert.equal(fixture.calls[0].where.price.gte, 29)
  assert.equal(fixture.calls[0].skip, 5)
  assert.equal(fixture.calls[0].orderBy[0].price, "asc")
  for (const field of ["installGuide", "files", "developerPaymentInfo", "xrayPassport"]) assert.ok(!Object.hasOwn(fixture.calls[0].select, field))
})

test("catalog API rejects malformed pages and limit values without any database request", async () => {
  for (const params of ["limit=0", "limit=-1", "limit=NaN", "limit=51", "limit=1e1", "limit=1&limit=2", "page=NaN", "category=bad", "minPrice=5&maxPrice=2"]) {
    const fixture = apiFixture()
    assert.equal((await fixture.GET(params)).status, 400)
    assert.equal(fixture.calls.length, 0)
  }
})

test("staff status filters remain authorized and validated", async () => {
  const buyer = apiFixture({ role: "BUYER" })
  assert.equal((await buyer.GET("status=REJECTED")).status, 200)
  assert.equal(buyer.calls[0].where.status, "APPROVED")
  const staff = apiFixture({ role: "MODERATOR" })
  assert.equal((await staff.GET("status=REJECTED")).status, 200)
  assert.equal(staff.calls[0].where.status, "REJECTED")
  assert.equal((await staff.GET("status=WRONG")).status, 400)
})

test("catalog API returns an availability error instead of an empty successful catalog", async () => {
  assert.equal((await apiFixture({ failure: true }).GET()).status, 503)
})

test("invalid catalog metadata never sends a casted unknown category to the database", async () => {
  const { generateMetadata } = loadModule("src/app/catalog/page.tsx", { mocks: {
    "@/lib/auth": {}, "@/lib/db": { db: { product: { count: () => { throw new Error("Must not query invalid filters") } } } },
    "@/components/catalog/CatalogFilters": {}, "@/components/catalog/ProductCard": {},
  } })
  const invalid = await generateMetadata({ searchParams: Promise.resolve({ category: "WRONG" }) })
  assert.equal(invalid.robots.index, false)
  assert.equal(invalid.alternates.canonical, "/catalog")
  const faceted = await generateMetadata({ searchParams: Promise.resolve({ category: "EXCEL", language: "VBA" }) })
  assert.equal(faceted.robots.index, false)
  assert.equal(faceted.alternates.canonical, "/catalog?category=EXCEL")
})

test("YDB list membership binds values separately from a fixed JSON path", () => {
  const { Query } = loadModule("src/lib/ydb/query.ts")
  const { modelFor } = loadModule("src/lib/ydb/schema.ts")
  const statement = new Query()
  const injection = "PYTHON') OR TRUE --"
  const filter = statement.condition(modelFor("Product"), { specification: { is: { languages: { has: injection }, platforms: { has: "LINUX" } } } })
  const sql = statement.text(filter)
  assert.match(sql, /JSON_EXISTS/)
  assert.match(sql, /PASSING \$p\d+ AS item/)
  assert.ok(!sql.includes(injection))
  assert.ok(JSON.stringify(statement.params).includes(injection))
  assert.throws(() => new Query().condition(modelFor("Product"), { title: { has: "bad" } }), /string list/)
})
