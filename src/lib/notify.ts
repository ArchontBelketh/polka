const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

async function sendMessage(chatId: string, text: string): Promise<void> {
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

export async function notifyNewSale(params: {
  developerTelegramId: string | null
  productTitle: string
  amountKopecks: number
  buyerEmail?: string | null
}): Promise<void> {
  if (!params.developerTelegramId) return
  const rubles = (params.amountKopecks / 100).toLocaleString("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
  })
  const commission = Math.round(
    (params.amountKopecks * Number(process.env.COMMISSION_RATE ?? "0.2")) / 100
  )
  const payout = ((params.amountKopecks - commission * 100) / 100).toLocaleString("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
  })
  await sendMessage(
    params.developerTelegramId,
    `💰 <b>Новая продажа!</b>\n\n` +
      `Продукт: ${params.productTitle}\n` +
      `Сумма: ${rubles}\n` +
      `Выплата (после удержания 7 дней): ${payout}\n` +
      (params.buyerEmail ? `Покупатель: ${params.buyerEmail}` : "")
  )
}

export async function notifyProductApproved(params: {
  developerTelegramId: string | null
  productTitle: string
  productSlug: string
}): Promise<void> {
  if (!params.developerTelegramId) return
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://polka.app"
  await sendMessage(
    params.developerTelegramId,
    `✅ <b>Продукт одобрен!</b>\n\n` +
      `«${params.productTitle}» прошёл модерацию и теперь доступен в каталоге.\n\n` +
      `🔗 ${appUrl}/product/${params.productSlug}`
  )
}

export async function notifyProductRejected(params: {
  developerTelegramId: string | null
  productTitle: string
  comment?: string | null
}): Promise<void> {
  if (!params.developerTelegramId) return
  await sendMessage(
    params.developerTelegramId,
    `❌ <b>Продукт отклонён</b>\n\n` +
      `«${params.productTitle}» не прошёл модерацию.\n` +
      (params.comment ? `\nКомментарий модератора: ${params.comment}` : "")
  )
}

export async function notifyDisputeOpened(params: {
  developerTelegramId: string | null
  productTitle: string
  reason: string
}): Promise<void> {
  if (!params.developerTelegramId) return
  await sendMessage(
    params.developerTelegramId,
    `⚠️ <b>Открыт спор</b>\n\n` +
      `Покупатель открыл спор по продукту «${params.productTitle}».\n` +
      `Причина: ${params.reason}\n\n` +
      `Наша команда свяжется с вами в течение 24 часов.`
  )
}
