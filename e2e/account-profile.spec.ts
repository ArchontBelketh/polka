import { test, expect } from "@playwright/test"

test("гость не может открыть личный профиль или изменить чужой", async ({ page, request }) => {
  await page.goto("/dashboard/profile")
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard%2Fprofile/)
  const response = await request.put("/api/developer/profile", { data: { userId: "someone-else", role: "ADMIN" } })
  expect(response.status()).toBe(401)
  expect((await request.post("/api/developer/upgrade")).status()).toBe(401)
  expect((await request.patch("/api/settings", { data: { name: "forged" } })).status()).toBe(401)
})

test.describe("Кабинет и профиль с тестовой БД", () => {
  test.skip(process.env.E2E_ACCOUNT_DATABASE !== "1", "Требуется работающая БД с выделенными тестовыми аккаунтами")

  test("покупатель использует общий кабинет без повторной регистрации", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/email/i).fill(process.env.E2E_TEST_EMAIL ?? "buyer@polka.test")
    await page.getByLabel(/пароль/i).first().fill(process.env.E2E_TEST_PASS ?? "password123")
    await page.getByRole("button", { name: /войти/i }).click()
    await expect(page).not.toHaveURL(/\/login/)
    await page.goto("/dashboard")
    await expect(page.getByRole("heading", { name: "Мой кабинет", exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: /Мои покупки/ }).last()).toHaveAttribute("href", "/purchases")
    await expect(page.getByRole("button", { name: "Включить профиль разработчика" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Заказать разработку", exact: true })).toHaveAttribute("href", "/request")
  })

  test("разработчик видит редактор и отдельную историю товаров", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/email/i).fill(process.env.E2E_DEVELOPER_EMAIL ?? "dev@polka.test")
    await page.getByLabel(/пароль/i).first().fill(process.env.E2E_DEVELOPER_PASS ?? "password123")
    await page.getByRole("button", { name: /войти/i }).click()
    await expect(page).not.toHaveURL(/\/login/)
    await page.goto("/dashboard/profile")
    await expect(page.getByRole("form", { name: "Публичный профиль разработчика" })).toBeVisible()
    await expect(page.getByLabel("Доступность", { exact: true })).toBeVisible()
    const link = page.getByRole("link", { name: "Открыть профиль", exact: true })
    await link.click()
    await expect(page.getByRole("heading", { name: "Готовый код", exact: true })).toBeVisible()
    await expect(page.getByText("Продажи и оценки ниже относятся к товарам магазина.", { exact: false })).toBeVisible()
  })
})
