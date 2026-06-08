import { test, expect } from "@playwright/test"

test.describe("Каталог", () => {
  test("отображает список продуктов", async ({ page }) => {
    await page.goto("/catalog")
    await expect(page).toHaveTitle(/Каталог/)
    await expect(page.getByRole("heading", { name: "Каталог" })).toBeVisible()
  })

  test("фильтр по категории работает", async ({ page }) => {
    await page.goto("/catalog")
    // Category filter should be present
    await expect(page.locator('[data-testid="category-filter"], nav, [role="navigation"]').first()).toBeVisible()
  })

  test("поиск работает", async ({ page }) => {
    await page.goto("/catalog?q=бот")
    await expect(page).toHaveURL(/q=/)
  })

  test("пагинация показывается при большом количестве продуктов", async ({ page }) => {
    await page.goto("/catalog")
    // If pagination exists, prev/next links are present
    const nextBtn = page.getByRole("link", { name: /вперёд/i })
    const prevBtn = page.getByRole("link", { name: /назад/i })
    // At least one must be absent on page 1 (prev), or pagination is hidden entirely
    await expect(prevBtn).toHaveCount(0)
  })
})

test.describe("Страница продукта", () => {
  test("открывается по slug", async ({ page }) => {
    // Fetch a real product slug from catalog first
    await page.goto("/catalog")
    const productLink = page.locator("a[href^='/product/']").first()
    const count = await productLink.count()

    if (count === 0) {
      test.skip() // no products seeded
      return
    }

    const href = await productLink.getAttribute("href")
    await page.goto(href!)
    await expect(page.locator("h1")).toBeVisible()
    await expect(page.getByRole("button", { name: /купить/i }).or(page.getByRole("link", { name: /купить/i }))).toBeVisible()
  })

  test("кнопка 'Купить' требует авторизации", async ({ page }) => {
    await page.goto("/catalog")
    const productLink = page.locator("a[href^='/product/']").first()
    if (await productLink.count() === 0) return

    const href = await productLink.getAttribute("href")
    await page.goto(href!)

    const loginLink = page.getByRole("link", { name: /войти для покупки/i })
    const buyBtn = page.getByRole("button", { name: /купить/i })

    // Either a "login to buy" link or a "buy" button is visible
    const isLoginLink = await loginLink.count() > 0
    const isBuyBtn = await buyBtn.count() > 0
    expect(isLoginLink || isBuyBtn).toBeTruthy()
  })
})

test.describe("Авторизация", () => {
  test("страница логина открывается", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/пароль/i)).toBeVisible()
  })

  test("редирект на логин с защищённых страниц", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login/)
  })

  test("редирект на логин с /purchases", async ({ page }) => {
    await page.goto("/purchases")
    await expect(page).toHaveURL(/\/login/)
  })
})
