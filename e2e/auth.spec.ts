import { test, expect } from "@playwright/test"
import { randomUUID } from "node:crypto"

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "buyer@polka.test"
const TEST_PASS  = process.env.E2E_TEST_PASS  ?? "password123"

test.describe("Полный цикл аутентификации", () => {
  test("вход создаёт действующую сессию покупателя", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/email/i).fill(TEST_EMAIL)
    await page.getByLabel(/пароль/i).first().fill(TEST_PASS)
    await page.getByRole("button", { name: /войти/i }).click()
    await expect(page).not.toHaveURL(/\/login/)
    const response = await page.request.get("/api/auth/session")
    expect(response.ok()).toBeTruthy()
    const session = await response.json()
    expect(session.user?.id).toBeTruthy()
    expect(session.user?.email).toBe(TEST_EMAIL.toLowerCase())
  })

  test("регистрация создаёт новый аккаунт и авторизует его", async ({ page }) => {
    test.skip(process.env.E2E_ALLOW_REGISTRATION !== "1", "Регистрация разрешена только в выделенном тестовом окружении")
    const email = `e2e-${randomUUID()}@${process.env.E2E_REGISTRATION_DOMAIN ?? "polka.test"}`
    await page.goto("/register")
    await page.getByLabel("Имя", { exact: true }).fill("E2E покупатель")
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/пароль/i).first().fill(TEST_PASS)
    await page.getByRole("checkbox", { name: /Принимаю/ }).check()
    const created = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/auth/register" && r.request().method() === "POST")
    await page.getByRole("button", { name: /создать аккаунт/i }).click()
    expect((await created).status()).toBe(201)
    await expect(page).toHaveURL(/\/catalog/)
    const session = await (await page.request.get("/api/auth/session")).json()
    expect(session.user?.id).toBeTruthy()
    expect(session.user?.email).toBe(email)
  })
})
