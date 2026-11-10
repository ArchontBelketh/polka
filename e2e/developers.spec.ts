import { test, expect } from "@playwright/test"

test("каталог разработчиков передаёт фильтры и сбрасывает страницу", async ({ page }) => {
  await page.goto("/developers?page=3")
  await expect(page.getByRole("heading", { name: "Разработчики", exact: true })).toBeVisible()
  await page.getByLabel("Имя или специализация", { exact: true }).fill("Боты")
  await page.getByLabel("Направление", { exact: true }).selectOption("BOTS")
  await page.getByLabel("Навык целиком", { exact: true }).fill("TypeScript")
  await page.getByLabel("Доступность", { exact: true }).selectOption("LIMITED")
  await page.getByRole("button", { name: "Применить", exact: true }).click()
  const params = new URL(page.url()).searchParams
  expect(params.get("q")).toBe("Боты"); expect(params.get("skill")).toBe("TypeScript"); expect(params.get("availability")).toBe("LIMITED"); expect(params.has("page")).toBe(false)
  await page.getByRole("link", { name: "Сбросить", exact: true }).click()
  await expect(page).toHaveURL(/\/developers$/)
})

test("некорректные фильтры показаны как ошибка, закрытые действия требуют входа", async ({ page, request }) => {
  await page.goto("/developers?availability=PRO")
  await expect(page.locator("main").getByRole("alert")).toBeVisible()
  for (const method of ["get", "post"] as const) expect((await request[method]("/api/developers/foreign/invitations")).status()).toBe(401)
  await page.goto("/admin/exposure")
  await expect(page).toHaveURL(/\/login/)
})

test("каталог доступен с клавиатуры и помещается на мобильных экранах", async ({ page }) => {
  await page.goto("/developers")
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 950 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.locator("#developer-query").focus(); await page.keyboard.press("Tab")
  await expect(page.locator("#developer-specialization")).toBeFocused()
  await expect(page.getByRole("link", { name: /Добавить свой профиль/ })).toHaveAttribute("href", "/dashboard/profile")
})

test("отключённая аналитика не пишет cookie, чужой origin отклоняется", async ({ request }) => {
  expect((await request.post("/api/developers/events", { headers: { origin: "https://foreign.invalid" }, data: {} })).status()).toBe(403)
  const origin = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").origin
  const response = await request.post("/api/developers/events", { headers: { origin, cookie: "cp_cookie_consent=necessary" }, data: {} })
  expect(response.status()).toBe(204); expect(response.headers()["set-cookie"]).toBeUndefined()
})
