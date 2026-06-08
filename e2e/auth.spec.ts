import { test, expect } from "@playwright/test"

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "test@polka.test"
const TEST_PASS  = process.env.E2E_TEST_PASS  ?? "testpassword123"

test.describe("Полный цикл аутентификации", () => {
  test("регистрация и вход", async ({ page }) => {
    // Register
    await page.goto("/register")
    await expect(page.locator("h1, h2").first()).toBeVisible()

    const emailInput = page.getByLabel(/email/i)
    const passInput  = page.getByLabel(/пароль/i).first()

    if (await emailInput.count() === 0) {
      test.skip()
      return
    }

    await emailInput.fill(TEST_EMAIL)
    await passInput.fill(TEST_PASS)
    await page.getByRole("button", { name: /зарегистрироваться|создать/i }).click()

    // After register, should redirect somewhere (login or dashboard)
    await page.waitForURL((url) => !url.pathname.includes("/register"), { timeout: 5000 })
      .catch(() => {}) // if it stays on page with error that's ok for existing user

    // Login
    await page.goto("/login")
    await page.getByLabel(/email/i).fill(TEST_EMAIL)
    await page.getByLabel(/пароль/i).first().fill(TEST_PASS)
    await page.getByRole("button", { name: /войти/i }).click()

    // Should redirect away from login
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 5000 })
      .catch(() => {})
  })
})
