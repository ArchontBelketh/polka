import { test, expect } from "@playwright/test"

test("каталог заказов передаёт фильтры и сбрасывает страницу", async ({ page }) => {
  await page.goto("/orders?page=3")
  await page.getByLabel("Поиск по задаче", { exact: true }).fill("Отчёт")
  await page.getByLabel("Специализация", { exact: true }).selectOption("SCRIPTS")
  await page.getByLabel("Бюджет от, ₽", { exact: true }).fill("100,29")
  await page.getByLabel("Бюджет до, ₽", { exact: true }).fill("200")
  await page.getByLabel("Желаемый срок до", { exact: true }).fill("2026-12-31")
  await page.getByRole("button", { name: "Применить", exact: true }).click()
  await expect(page).toHaveURL(/specialization=SCRIPTS/)
  const params = new URL(page.url()).searchParams
  expect(params.get("q")).toBe("Отчёт")
  expect(params.get("minBudget")).toBe("100,29")
  expect(params.get("deadlineBefore")).toBe("2026-12-31")
  expect(params.has("page")).toBe(false)
  await page.getByRole("link", { name: "Сбросить", exact: true }).click()
  await expect(page).toHaveURL(/\/orders$/)
})

test("ошибки фильтров не превращаются в пустую выдачу", async ({ page, request }) => {
  await page.goto("/orders?minBudget=200&maxBudget=100")
  await expect(page.locator("main").getByRole("alert")).toContainText("Бюджет")
  expect((await request.get("/api/orders?status=OPEN&status=ALL")).status()).toBe(400)
})

test("закрытые действия и рабочая область требуют входа", async ({ request, page }) => {
  for (const url of ["/api/orders", "/api/orders/foreign", "/api/orders/foreign/proposals", "/api/orders/foreign/attachments"]) expect((await request.post(url, { data: {} })).status()).toBe(401)
  for (const url of ["/api/orders/foreign/proposals", "/api/orders/foreign/workspace", "/api/orders/foreign/attachments/foreign"]) expect((await request.get(url)).status()).toBe(401)
  await page.goto("/orders/new")
  await expect(page).toHaveURL(/\/login\?/)
})

test("каталог заказов доступен с клавиатуры и помещается на мобильном экране", async ({ page }) => {
  await page.goto("/orders")
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.locator("#jobs-query").focus()
  await page.keyboard.press("Tab")
  await expect(page.locator("#jobs-specialization")).toBeFocused()
})
