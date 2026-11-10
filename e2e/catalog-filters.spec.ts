import { test, expect } from "@playwright/test"

test("поля каталога применяются вместе и сбрасывают номер страницы", async ({ page }) => {
  await page.goto("/catalog?category=AUTOMATION&page=3")
  const form = page.getByRole("form", { name: "Подобрать готовый код" })
  await form.getByLabel("Поиск по названию и описанию").fill("бот и отчёт")
  await form.getByLabel("Язык", { exact: true }).selectOption("PYTHON")
  await form.getByLabel("Платформа", { exact: true }).selectOption("LINUX")
  await form.getByLabel("Лицензия", { exact: true }).selectOption("commercial")
  await form.getByLabel("Совместимость", { exact: true }).fill("Python 3.12")
  await form.getByLabel("Цена от", { exact: true }).fill("0,29")
  await form.getByLabel("Цена до", { exact: true }).fill("5000")
  await form.getByLabel("Сортировка", { exact: true }).selectOption("price_asc")
  await form.getByRole("button", { name: "Применить фильтры" }).click()
  await expect(page).toHaveURL((url) => url.searchParams.get("language") === "PYTHON")
  const params = new URL(page.url()).searchParams
  for (const [key, value] of Object.entries({ category: "AUTOMATION", q: "бот и отчёт", language: "PYTHON", platform: "LINUX", license: "commercial", compatibility: "Python 3.12", minPrice: "0.29", maxPrice: "5000", sort: "price_asc" })) expect(params.get(key)).toBe(value)
  expect(params.has("page")).toBe(false)
})

test("смена категории сохраняет фильтры, сброс и возврат синхронизируют поля с адресом", async ({ page }) => {
  await page.goto("/catalog?language=VBA&platform=EXCEL&license=commercial&q=отчёт&page=2")
  const categories = page.getByRole("navigation", { name: "Назначение продукта" })
  const excel = categories.locator('a[href*="category=EXCEL"]')
  await excel.click()
  await expect(page).toHaveURL((url) => url.searchParams.get("category") === "EXCEL")
  expect(new URL(page.url()).searchParams.get("language")).toBe("VBA")
  expect(new URL(page.url()).searchParams.has("page")).toBe(false)
  await page.getByRole("link", { name: "Сбросить всё", exact: true }).click()
  await expect(page).toHaveURL(/\/catalog$/)
  await expect(page.getByLabel("Язык", { exact: true })).toHaveValue("")
  await expect(page.getByLabel("Поиск по названию и описанию")).toHaveValue("")
  await page.goBack()
  await expect(page.getByLabel("Язык", { exact: true })).toHaveValue("VBA")
  await expect(page.getByLabel("Поиск по названию и описанию")).toHaveValue("отчёт")
})

test("некорректная цена остаётся в форме и не отправляет некорректный запрос", async ({ page }) => {
  await page.goto("/catalog")
  const form = page.getByRole("form", { name: "Подобрать готовый код" })
  await form.getByLabel("Цена от", { exact: true }).fill("100")
  await form.getByLabel("Цена до", { exact: true }).fill("20")
  await form.getByRole("button", { name: "Применить фильтры" }).click()
  await expect(form.getByRole("alert")).toContainText("не должна превышать")
  await expect(page).toHaveURL(/\/catalog$/)
  await expect(form.getByLabel("Цена от", { exact: true })).toHaveValue("100")
})

test("ошибочные адреса каталога обрабатываются без падения страницы", async ({ page, request }) => {
  const response = await page.goto("/catalog?category=WRONG&minPrice=NaN")
  expect(response?.status()).toBe(200)
  await expect(page.getByRole("heading", { name: "Готовый код", exact: true })).toBeVisible()
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Не удалось применить фильтры")
  expect((await request.get("/api/products?category=WRONG")).status()).toBe(400)
  expect((await request.get("/api/products?page=NaN")).status()).toBe(400)
  expect((await request.get("/api/products?limit=-1")).status()).toBe(400)
})

test("фильтры помещаются на мобильном экране и доступны с клавиатуры", async ({ page }) => {
  await page.goto("/catalog?language=ONE_C&platform=WINDOWS&compatibility=8.3&license=personal")
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 375, height: 900 })
  const form = page.getByRole("form", { name: "Подобрать готовый код" })
  await form.getByLabel("Поиск по названию и описанию").focus()
  await page.keyboard.type("обработка")
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL((url) => url.searchParams.get("q") === "обработка")
})

test("гость не может менять характеристики или создавать товар", async ({ request }) => {
  expect((await request.put("/api/products/foreign/specification", { data: { productId: "foreign", status: "APPROVED" } })).status()).toBe(401)
  expect((await request.post("/api/products", { data: { title: "forged" } })).status()).toBe(401)
})
