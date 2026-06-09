import nodemailer from "nodemailer"

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://polka.app"

// ── Email transport ────────────────────────────────────────────────────────
function getMailTransport() {
  const host = process.env.SMTP_HOST
  if (!host) return null
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const transport = getMailTransport()
  if (!transport || !to) return
  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? `"ПОЛКА" <noreply@polka.app>`,
      to,
      subject,
      html,
    })
  } catch {
    // non-critical — don't throw
  }
}

// ── Telegram ───────────────────────────────────────────────────────────────
async function sendTelegram(chatId: string, text: string): Promise<void> {
  if (!BOT_TOKEN || !chatId) return
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    })
  } catch {
    // non-critical — don't throw
  }
}

// ── Notifications ──────────────────────────────────────────────────────────

export async function notifyNewSale(params: {
  developerTelegramId: string | null
  developerEmail?: string | null
  productTitle: string
  amountKopecks: number
  buyerEmail?: string | null
}): Promise<void> {
  const commission = Math.round(params.amountKopecks * Number(process.env.COMMISSION_RATE ?? "0.2"))
  const payoutKopecks = params.amountKopecks - commission
  const fmt = (k: number) =>
    (k / 100).toLocaleString("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 })

  const tgText =
    `💰 <b>Новая продажа!</b>\n\n` +
    `Продукт: ${params.productTitle}\n` +
    `Сумма: ${fmt(params.amountKopecks)}\n` +
    `Выплата (после удержания 7 дней): ${fmt(payoutKopecks)}\n` +
    (params.buyerEmail ? `Покупатель: ${params.buyerEmail}` : "")

  const emailHtml = `
    <h2>💰 Новая продажа!</h2>
    <p><b>Продукт:</b> ${params.productTitle}</p>
    <p><b>Сумма:</b> ${fmt(params.amountKopecks)}</p>
    <p><b>Выплата</b> (после 7-дневного удержания): <b>${fmt(payoutKopecks)}</b></p>
    ${params.buyerEmail ? `<p>Покупатель: ${params.buyerEmail}</p>` : ""}
    <p><a href="${APP_URL}/dashboard">Открыть кабинет разработчика</a></p>
  `

  await Promise.all([
    params.developerTelegramId ? sendTelegram(params.developerTelegramId, tgText) : Promise.resolve(),
    params.developerEmail ? sendEmail(params.developerEmail, `Новая продажа: ${params.productTitle}`, emailHtml) : Promise.resolve(),
  ])
}

export async function notifyProductApproved(params: {
  developerTelegramId: string | null
  developerEmail?: string | null
  productTitle: string
  productSlug: string
}): Promise<void> {
  const url = `${APP_URL}/product/${params.productSlug}`

  const tgText =
    `✅ <b>Продукт одобрен!</b>\n\n` +
    `«${params.productTitle}» прошёл модерацию и теперь доступен в каталоге.\n\n` +
    `🔗 ${url}`

  const emailHtml = `
    <h2>✅ Продукт одобрен!</h2>
    <p>«${params.productTitle}» прошёл модерацию и теперь доступен в каталоге.</p>
    <p><a href="${url}">Открыть страницу продукта</a></p>
  `

  await Promise.all([
    params.developerTelegramId ? sendTelegram(params.developerTelegramId, tgText) : Promise.resolve(),
    params.developerEmail ? sendEmail(params.developerEmail, `Продукт одобрен: ${params.productTitle}`, emailHtml) : Promise.resolve(),
  ])
}

export async function notifyProductRejected(params: {
  developerTelegramId: string | null
  developerEmail?: string | null
  productTitle: string
  comment?: string | null
}): Promise<void> {
  const tgText =
    `❌ <b>Продукт отклонён</b>\n\n` +
    `«${params.productTitle}» не прошёл модерацию.\n` +
    (params.comment ? `\nКомментарий модератора: ${params.comment}` : "")

  const emailHtml = `
    <h2>❌ Продукт отклонён</h2>
    <p>«${params.productTitle}» не прошёл модерацию.</p>
    ${params.comment ? `<p><b>Комментарий модератора:</b> ${params.comment}</p>` : ""}
    <p><a href="${APP_URL}/dashboard/products">Перейти к моим продуктам</a></p>
  `

  await Promise.all([
    params.developerTelegramId ? sendTelegram(params.developerTelegramId, tgText) : Promise.resolve(),
    params.developerEmail ? sendEmail(params.developerEmail, `Продукт отклонён: ${params.productTitle}`, emailHtml) : Promise.resolve(),
  ])
}

export async function notifyDisputeOpened(params: {
  developerTelegramId: string | null
  developerEmail?: string | null
  productTitle: string
  reason: string
}): Promise<void> {
  const tgText =
    `⚠️ <b>Открыт спор</b>\n\n` +
    `Покупатель открыл спор по продукту «${params.productTitle}».\n` +
    `Причина: ${params.reason}\n\n` +
    `Наша команда свяжется с вами в течение 24 часов.`

  const emailHtml = `
    <h2>⚠️ Открыт спор</h2>
    <p>Покупатель открыл спор по продукту «${params.productTitle}».</p>
    <p><b>Причина:</b> ${params.reason}</p>
    <p>Наша команда свяжется с вами в течение 24 часов.</p>
  `

  await Promise.all([
    params.developerTelegramId ? sendTelegram(params.developerTelegramId, tgText) : Promise.resolve(),
    params.developerEmail ? sendEmail(params.developerEmail, `Открыт спор: ${params.productTitle}`, emailHtml) : Promise.resolve(),
  ])
}

export async function notifyVersionRejected(params: {
  developerTelegramId: string | null
  developerEmail?: string | null
  productTitle: string
  version: string
  comment?: string
}): Promise<void> {
  const tgText =
    `❌ <b>Версия отклонена</b>\n\n` +
    `Версия <b>${params.version}</b> продукта «${params.productTitle}» не прошла модерацию.\n` +
    (params.comment ? `\nПричина: ${params.comment}` : "")

  const emailHtml = `
    <h2>❌ Версия отклонена</h2>
    <p>Версия <b>${params.version}</b> продукта «${params.productTitle}» не прошла модерацию.</p>
    ${params.comment ? `<p><b>Причина:</b> ${params.comment}</p>` : ""}
    <p><a href="${APP_URL}/dashboard/products">Перейти к моим продуктам</a></p>
  `

  await Promise.all([
    params.developerTelegramId ? sendTelegram(params.developerTelegramId, tgText) : Promise.resolve(),
    params.developerEmail
      ? sendEmail(params.developerEmail, `Версия отклонена: ${params.productTitle} v${params.version}`, emailHtml)
      : Promise.resolve(),
  ])
}

export async function notifyNewVersion(params: {
  productTitle: string
  productSlug: string
  version: string
  changelog?: string | null
  buyers: Array<{ telegramId: string | null; email: string | null }>
}): Promise<void> {
  const url = `${APP_URL}/product/${params.productSlug}`

  const tgText =
    `🔄 <b>Обновление: ${params.productTitle}</b>\n\n` +
    `Вышла версия <b>${params.version}</b>.\n` +
    (params.changelog ? `\nЧто нового:\n${params.changelog}\n\n` : "\n") +
    `Скачать: ${url}`

  const emailHtml = `
    <h2>🔄 Обновление продукта</h2>
    <p>Вышла новая версия <b>${params.version}</b> продукта «${params.productTitle}».</p>
    ${params.changelog ? `<p><b>Что нового:</b></p><p style="white-space:pre-wrap">${params.changelog}</p>` : ""}
    <p><a href="${url}">Перейти к продукту и скачать обновление</a></p>
  `

  await Promise.all(
    params.buyers.flatMap((buyer) => [
      buyer.telegramId ? sendTelegram(buyer.telegramId, tgText) : Promise.resolve(),
      buyer.email
        ? sendEmail(buyer.email, `Обновление: ${params.productTitle} v${params.version}`, emailHtml)
        : Promise.resolve(),
    ]),
  )
}

export async function notifyProductAutoApproved(params: {
  developerTelegramId: string | null
  developerEmail?: string | null
  productTitle: string
  productSlug: string
}): Promise<void> {
  const url = `${APP_URL}/product/${params.productSlug}`
  const tgText =
    `✅ <b>Продукт опубликован!</b>\n\n` +
    `«${params.productTitle}» прошёл автоматическую проверку и доступен в каталоге.\n\n` +
    `🔗 ${url}`
  const emailHtml = `
    <h2>✅ Продукт опубликован!</h2>
    <p>«${params.productTitle}» прошёл автоматическую проверку и теперь доступен в каталоге.</p>
    <p><a href="${url}">Открыть страницу продукта</a></p>
  `
  await Promise.all([
    params.developerTelegramId ? sendTelegram(params.developerTelegramId, tgText) : Promise.resolve(),
    params.developerEmail ? sendEmail(params.developerEmail, `Продукт опубликован: ${params.productTitle}`, emailHtml) : Promise.resolve(),
  ])
}

export async function notifyProductAutoRejected(params: {
  developerTelegramId: string | null
  developerEmail?: string | null
  productTitle: string
  reasons: string[]
}): Promise<void> {
  const reasonsList = params.reasons.map((r) => `• ${r}`).join("\n")
  const tgText =
    `❌ <b>Автоматическая проверка не пройдена</b>\n\n` +
    `«${params.productTitle}» содержит критические проблемы безопасности.` +
    (reasonsList ? `\n\nПричины:\n${reasonsList}` : "") +
    `\n\nЕсли считаете это ошибкой — обратитесь в поддержку.`
  const reasonsHtml = params.reasons.length
    ? `<p><b>Причины:</b></p><ul>${params.reasons.map((r) => `<li>${r}</li>`).join("")}</ul>`
    : ""
  const emailHtml = `
    <h2>❌ Автоматическая проверка не пройдена</h2>
    <p>«${params.productTitle}» содержит критические проблемы безопасности и не может быть опубликован.</p>
    ${reasonsHtml}
    <p>Если считаете это ошибкой — обратитесь в <a href="${APP_URL}/support">поддержку</a>.</p>
  `
  await Promise.all([
    params.developerTelegramId ? sendTelegram(params.developerTelegramId, tgText) : Promise.resolve(),
    params.developerEmail ? sendEmail(params.developerEmail, `Продукт не прошёл проверку: ${params.productTitle}`, emailHtml) : Promise.resolve(),
  ])
}

export async function notifyPurchaseConfirmed(params: {
  buyerEmail: string | null
  productTitle: string
  purchaseId: string
}): Promise<void> {
  if (!params.buyerEmail) return
  const emailHtml = `
    <h2>✅ Покупка подтверждена!</h2>
    <p>Ваша покупка «${params.productTitle}» успешно оплачена.</p>
    <p><a href="${APP_URL}/purchases">Перейти к моим покупкам и скачать файл</a></p>
    <p style="color:#888;font-size:12px;">ID покупки: ${params.purchaseId}</p>
  `
  await sendEmail(params.buyerEmail, `Покупка подтверждена: ${params.productTitle}`, emailHtml)
}
