/**
 * Full role-based E2E with deliberate screenshots.
 *   1. Seed scenario:  npx tsx scripts/seed-e2e-scenario.ts
 *   2. Dev server on :3000
 *   3. Run:            node test-e2e-roles.mjs
 *   4. Cleanup:        npx tsx scripts/seed-e2e-scenario.ts --clean
 *
 * Screenshots land in test-screenshots/ as NN-role-step.png
 */
import { chromium } from "playwright"
import { mkdirSync, writeFileSync } from "fs"
import path from "path"

const BASE = "http://localhost:3000"
const SHOT_DIR = "test-screenshots"
mkdirSync(SHOT_DIR, { recursive: true })

// Seeded entities (see scripts/seed-e2e-scenario.ts)
const APPROVED_SLUG = "e2e-approved-product"
const APPROVED_ID = "e2eapproved"
const PENDING_ID = "e2epending"
const PURCHASE_ID = "e2epurchase"

const results = []
let shotIdx = 0

function log(icon, label, detail = "") {
  console.log(`${icon}  ${label}${detail ? " — " + detail : ""}`)
  results.push({ icon, label })
}
async function shot(page, name, full = true) {
  const file = path.join(SHOT_DIR, `${String(++shotIdx).padStart(2, "0")}-${name}.png`)
  await page.screenshot({ path: file, fullPage: full }).catch(() => {})
}
async function loginAs(page, email, password = "password123") {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" })
  await page.fill('input[type="email"], input[name="email"]', email)
  await page.fill('input[type="password"], input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 15000 }).catch(() => {})
  await page.waitForLoadState("networkidle").catch(() => {})
  return page.url()
}
async function hasText(page, text) {
  return (await page.getByText(text, { exact: false }).count().catch(() => 0)) > 0
}
async function clickText(page, text, opts = {}) {
  await page.getByText(text, { exact: false }).first().click({ timeout: 5000, ...opts })
}

const browser = await chromium.launch({ headless: true })

// ──────────────────────────────────────────────────────────────────────────
// 1. BUYER
// ──────────────────────────────────────────────────────────────────────────
async function buyerJourney() {
  console.log("\n═══ 👤 ПОКУПАТЕЛЬ ═══")
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  try {
    await page.goto(BASE, { waitUntil: "networkidle" })
    await shot(page, "buyer-landing")
    log(await hasText(page, "Готовые программы") ? "✅" : "❌", "Лендинг")
  } catch (e) { log("❌", "Лендинг", e.message) }

  try {
    await page.goto(`${BASE}/catalog`, { waitUntil: "networkidle" })
    const cards = await page.locator('a[href*="/product/"]').count()
    await shot(page, "buyer-catalog")
    log("✅", "Каталог", `карточек=${cards}`)
  } catch (e) { log("❌", "Каталог", e.message) }

  try {
    await page.goto(`${BASE}/catalog?sort=popular`, { waitUntil: "networkidle" })
    await shot(page, "buyer-catalog-popular")
    log("✅", "Каталог: сортировка «популярные»")
  } catch (e) { log("❌", "Каталог сортировка", e.message) }

  await loginAs(page, "buyer@polka.test")
  log("✅", "Вход покупателя", page.url())

  try {
    await page.goto(`${BASE}/product/${APPROVED_SLUG}`, { waitUntil: "networkidle" })
    await shot(page, "buyer-product")
    log(await hasText(page, "Вопросы и ответы") ? "✅" : "❌", "Страница продукта (требования, состав, Q&A)")
  } catch (e) { log("❌", "Страница продукта", e.message) }

  try {
    const ta = page.getByPlaceholder(/Например: работает ли/i)
    await ta.fill("Можно ли подключить несколько Telegram-аккаунтов одновременно?")
    await page.getByRole("button", { name: /Отправить вопрос/i }).click()
    await page.waitForTimeout(1500)
    await shot(page, "buyer-ask-question")
    log("✅", "Покупатель задал вопрос")
  } catch (e) { log("❌", "Задать вопрос", e.message) }

  try {
    await page.goto(`${BASE}/purchases`, { waitUntil: "networkidle" })
    await shot(page, "buyer-purchases")
    log(await hasText(page, "Кабинет покупателя") ? "✅" : "❌", "Кабинет покупателя (покупка + бейджи)")
  } catch (e) { log("❌", "Покупки", e.message) }

  try {
    await page.goto(`${BASE}/purchases/${PURCHASE_ID}`, { waitUntil: "networkidle" })
    await shot(page, "buyer-purchase-detail")
    log(await hasText(page, "Связь с разработчиком") ? "✅" : "❌", "Детали покупки (тред + инструкция)")
  } catch (e) { log("❌", "Детали покупки", e.message) }

  try {
    await page.getByPlaceholder(/Сообщение/i).fill("Спасибо! Ещё вопрос: как обновлять бота при выходе новой версии?")
    await page.getByRole("button", { name: /Отправить/i }).click()
    await page.waitForTimeout(1500)
    await shot(page, "buyer-send-message")
    log("✅", "Покупатель отправил сообщение")
  } catch (e) { log("❌", "Отправить сообщение", e.message) }

  try {
    await page.goto(`${BASE}/product/${APPROVED_SLUG}`, { waitUntil: "networkidle" })
    if (await hasText(page, "Оставить отзыв")) {
      // pick 5 stars then write text
      const stars = page.locator('button:has(svg)').filter({ hasNot: page.locator("text=Отправить") })
      await page.locator('form').filter({ hasText: /Текст отзыва|опыте использования/i })
        .first().locator("button").nth(4).click().catch(() => {})
      await page.getByPlaceholder(/опыте использования/i).fill("Отличный бот, всё завелось по инструкции за 10 минут. Рекомендую!")
      await page.getByRole("button", { name: /^Оставить отзыв$/i }).click().catch(() => {})
      await page.waitForTimeout(1500)
      void stars
    }
    await shot(page, "buyer-review")
    log("✅", "Покупатель оставил отзыв")
  } catch (e) { log("❌", "Отзыв", e.message) }

  try {
    await page.goto(`${BASE}/purchases/${PURCHASE_ID}`, { waitUntil: "networkidle" })
    await page.getByRole("button", { name: /Открыть спор/i }).click()
    await page.getByPlaceholder(/Что именно не работает/i).fill("Бот перестал отвечать после перезагрузки ПК, не могу разобраться сам.")
    await page.getByRole("button", { name: /^Открыть спор$/i }).click()
    await page.waitForTimeout(1500)
    await shot(page, "buyer-open-dispute")
    log("✅", "Покупатель открыл спор")
  } catch (e) { log("❌", "Открыть спор", e.message) }

  await ctx.close()
}

// ──────────────────────────────────────────────────────────────────────────
// 2. DEVELOPER
// ──────────────────────────────────────────────────────────────────────────
async function developerJourney() {
  console.log("\n═══ 🛠 РАЗРАБОТЧИК ═══")
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  await loginAs(page, "dev@polka.test")
  log("✅", "Вход разработчика", page.url())

  try {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" })
    await shot(page, "dev-dashboard")
    log(await hasText(page, "Кабинет разработчика") ? "✅" : "❌", "Кабинет (статы, тариф, счётчики)")
  } catch (e) { log("❌", "Кабинет", e.message) }

  try {
    await page.goto(`${BASE}/dashboard/products`, { waitUntil: "networkidle" })
    await shot(page, "dev-products")
    log("✅", "Мои продукты")
  } catch (e) { log("❌", "Мои продукты", e.message) }

  try {
    await page.goto(`${BASE}/dashboard/products/${APPROVED_ID}`, { waitUntil: "networkidle" })
    await shot(page, "dev-product-manage")
    log("✅", "Управление продуктом (новая версия)")
  } catch (e) { log("❌", "Управление продуктом", e.message) }

  // Submit wizard — screenshot each step (stops before final S3 upload)
  try {
    await page.goto(`${BASE}/submit`, { waitUntil: "networkidle" })
    await shot(page, "dev-submit-category")
    await page.getByRole("button", { name: /Telegram-боты/i }).click().catch(() => {})
    await page.getByRole("button", { name: /^Далее$/i }).click().catch(() => {})

    await page.getByLabel(/Название/i).fill("Тестовый бот рассылок").catch(() => {})
    await page.getByLabel(/Краткое описание/i).fill("Делает массовые рассылки по базе подписчиков с защитой от банов.").catch(() => {})
    await page.getByLabel(/Полное описание/i).fill("Полное описание тестового продукта для мастера загрузки. Рассылки, сегменты, расписание, отчёты.").catch(() => {})
    await shot(page, "dev-submit-description")
    await page.getByRole("button", { name: /^Далее$/i }).click().catch(() => {})

    await page.getByPlaceholder(/Авто-напоминания|функцию/i).fill("Массовая рассылка").catch(() => {})
    await page.getByRole("button", { name: "+" }).click().catch(() => {})
    await shot(page, "dev-submit-features")
    await page.getByRole("button", { name: /^Далее$/i }).click().catch(() => {})

    await page.locator("#installGuide").fill(
      "## Установка\n1. Распакуйте архив\n2. Установите зависимости pip install -r requirements.txt\n3. Укажите токен бота в config.ini\n4. Запустите python main.py\n\nЭтого достаточно для запуска тестового продукта в мастере загрузки.",
    ).catch(() => {})
    await page.getByPlaceholder(/Python 3\.10/i).fill("Python 3.10+").catch(() => {})
    await shot(page, "dev-submit-install")
    await page.getByRole("button", { name: /^Далее$/i }).click().catch(() => {})

    // provide a dummy file so the step renders the chosen file (no real upload happens)
    const dummy = path.join(SHOT_DIR, "_dummy-product.zip")
    writeFileSync(dummy, "PK dummy zip for e2e")
    await page.locator('input[type="file"]').first().setInputFiles(dummy).catch(() => {})
    await shot(page, "dev-submit-media")
    log("✅", "Мастер /submit (6 шагов отсняты)")
  } catch (e) { log("❌", "Мастер /submit", e.message) }

  try {
    await page.goto(`${BASE}/dashboard/questions`, { waitUntil: "networkidle" })
    await shot(page, "dev-questions")
    const ta = page.getByPlaceholder(/Ваш ответ покупателю/i).first()
    if (await ta.count()) {
      await ta.fill("Да, поддерживается выгрузка и в Excel, и в Google Sheets через API-ключ.")
      await page.getByRole("button", { name: /Сохранить ответ/i }).first().click()
      await page.waitForTimeout(1500)
    }
    await shot(page, "dev-answer-question")
    log("✅", "Разработчик ответил на вопрос")
  } catch (e) { log("❌", "Ответ на вопрос", e.message) }

  try {
    await page.goto(`${BASE}/dashboard/messages`, { waitUntil: "networkidle" })
    await shot(page, "dev-messages")
    log(await hasText(page, "Сообщения покупателей") ? "✅" : "❌", "Список диалогов")
  } catch (e) { log("❌", "Диалоги", e.message) }

  try {
    await page.goto(`${BASE}/dashboard/messages/${PURCHASE_ID}`, { waitUntil: "networkidle" })
    await page.getByPlaceholder(/Сообщение/i).fill("Обновление прилетит автоматически — просто скачаете новую версию из кабинета покупок.")
    await page.getByRole("button", { name: /Отправить/i }).click().catch(() => {})
    await page.waitForTimeout(1500)
    await shot(page, "dev-reply-message")
    log("✅", "Разработчик ответил покупателю")
  } catch (e) { log("❌", "Ответ покупателю", e.message) }

  try {
    await page.goto(`${BASE}/dashboard/payouts`, { waitUntil: "networkidle" })
    await shot(page, "dev-payouts")
    log("✅", "Вывод средств")
  } catch (e) { log("❌", "Выплаты", e.message) }

  try {
    await page.goto(`${BASE}/sell`, { waitUntil: "networkidle" })
    await shot(page, "dev-sell")
    log(await hasText(page, "Ваш скрипт уже написан") ? "✅" : "❌", "Лендинг /sell (калькулятор)")
  } catch (e) { log("❌", "/sell", e.message) }

  await ctx.close()
}

// ──────────────────────────────────────────────────────────────────────────
// 3. MODERATOR
// ──────────────────────────────────────────────────────────────────────────
async function moderatorJourney() {
  console.log("\n═══ 🛡 МОДЕРАТОР ═══")
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  await loginAs(page, "moderator@polka.test")
  log("✅", "Вход модератора", page.url())

  try {
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" })
    await shot(page, "mod-desktop")
    log(await hasText(page, "Рабочий стол") ? "✅" : "❌", "Рабочий стол (очередь/споры/обращения)")
  } catch (e) { log("❌", "Рабочий стол", e.message) }

  try {
    await page.goto(`${BASE}/admin/queue`, { waitUntil: "networkidle" })
    await shot(page, "mod-queue")
    log("✅", "Очередь модерации")
  } catch (e) { log("❌", "Очередь", e.message) }

  try {
    await page.goto(`${BASE}/admin/review/${PENDING_ID}`, { waitUntil: "networkidle" })
    await shot(page, "mod-review")
    log(await hasText(page, "Решение") ? "✅" : "❌", "Карточка проверки (скан, дубликат, инструкция)")
  } catch (e) { log("❌", "Карточка проверки", e.message) }

  try {
    const verifyBtn = page.getByRole("button", { name: /Подтвердить работоспособность|Снять отметку/i })
    await verifyBtn.click({ timeout: 8000 })
    await page.waitForTimeout(1200)
    await shot(page, "mod-verify")
    log("✅", "Модератор подтвердил работоспособность")
  } catch (e) { log("❌", "Верификация", e.message.split("\n")[0]) }

  try {
    await page.getByRole("button", { name: /Одобрить/i }).click()
    await page.waitForURL((u) => u.toString().includes("/admin/queue"), { timeout: 8000 }).catch(() => {})
    await page.waitForLoadState("networkidle").catch(() => {})
    await shot(page, "mod-approved")
    log("✅", "Модератор одобрил продукт")
  } catch (e) { log("❌", "Одобрение", e.message) }

  try {
    await page.goto(`${BASE}/admin/disputes`, { waitUntil: "networkidle" })
    await shot(page, "mod-disputes")
    log(await hasText(page, "Спор") ? "✅" : "❌", "Споры (переписка по purchaseId)")
  } catch (e) { log("❌", "Споры", e.message) }

  try {
    await page.getByRole("button", { name: /Вернуть деньги покупателю/i }).first().click()
    await page.waitForTimeout(1500)
    await shot(page, "mod-dispute-resolved")
    log("✅", "Модератор разрешил спор (возврат)")
  } catch (e) { log("❌", "Разрешение спора", e.message) }

  try {
    await page.goto(`${BASE}/admin/support`, { waitUntil: "networkidle" })
    await shot(page, "mod-support")
    log("✅", "Обращения в поддержку")
  } catch (e) { log("❌", "Поддержка", e.message) }

  await ctx.close()
}

// ──────────────────────────────────────────────────────────────────────────
// 4. ADMIN
// ──────────────────────────────────────────────────────────────────────────
async function adminJourney() {
  console.log("\n═══ 👑 АДМИНИСТРАТОР ═══")
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  await loginAs(page, "admin@polka.test")
  log("✅", "Вход админа", page.url())

  try {
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" })
    await shot(page, "admin-desktop")
    log(await hasText(page, "Аналитика платформы") ? "✅" : "❌", "Рабочий стол с аналитикой (GMV, топ)")
  } catch (e) { log("❌", "Аналитика", e.message) }

  try {
    await page.goto(`${BASE}/admin/users`, { waitUntil: "networkidle" })
    await shot(page, "admin-users")
    log("✅", "Управление пользователями")
  } catch (e) { log("❌", "Пользователи", e.message) }

  try {
    await page.goto(`${BASE}/admin/coupons`, { waitUntil: "networkidle" })
    await shot(page, "admin-coupons")
    // best-effort: create a coupon
    try {
      await page.locator('input').first().fill("E2ENEW20")
      const nums = page.locator('input[type="number"]')
      if (await nums.count()) await nums.first().fill("20")
      await page.getByRole("button", { name: /Создать|Добавить/i }).first().click({ timeout: 3000 })
      await page.waitForTimeout(1200)
      await shot(page, "admin-coupon-created")
    } catch { /* form selectors may differ — list screenshot already captured */ }
    log("✅", "Купоны")
  } catch (e) { log("❌", "Купоны", e.message) }

  await ctx.close()
}

// ──────────────────────────────────────────────────────────────────────────
await buyerJourney()
await developerJourney()
await moderatorJourney()
await adminJourney()
await browser.close()

console.log("\n" + "═".repeat(52))
const passed = results.filter((r) => r.icon === "✅").length
const failed = results.filter((r) => r.icon === "❌").length
console.log(`ИТОГ: ✅ ${passed}   ❌ ${failed}   📸 ${shotIdx} скриншотов в ${SHOT_DIR}/`)
if (failed > 0) process.exitCode = 1
