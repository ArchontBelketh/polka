import nodemailer from "nodemailer"
import { SERVICE_LABELS } from "@/lib/services"
import { ACCESS_CHECKLIST } from "@/lib/relay"
import type { ServiceKind } from "@/generated/prisma/client"

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

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
      from: process.env.SMTP_FROM ?? `"CYBERПОЛКА" <noreply@cyberpolka.store>`,
      to,
      subject,
      html,
    })
  } catch {
    // non-critical — don't throw
  }
}

function escapeHtml(s: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }
  return s.replace(/[&<>"']/g, (c) => map[c])
}

/**
 * Обращение в поддержку со страницы технических работ. Отправляется письмом на
 * адрес поддержки (reply-to — email автора), без обращения к БД — чтобы работать
 * во время обслуживания/миграции. Возвращает true при успешной отправке.
 */
export async function sendSupportRequest(params: {
  fromEmail: string
  subject: string
  message: string
  meta?: string
}): Promise<boolean> {
  const transport = getMailTransport()
  const to = process.env.SUPPORT_EMAIL ?? "support@cyberpolka.store"
  if (!transport) {
    console.error("[support] SMTP не настроен: нет SMTP_HOST в окружении")
    return false
  }
  const html = `
    <h2>Обращение со страницы технических работ</h2>
    <p><b>Тема:</b> ${escapeHtml(params.subject)}</p>
    <p><b>Email для ответа:</b> ${escapeHtml(params.fromEmail)}</p>
    <p><b>Сообщение:</b></p>
    <p style="white-space:pre-wrap">${escapeHtml(params.message)}</p>
    ${params.meta ? `<p style="color:#888;font-size:12px">${escapeHtml(params.meta)}</p>` : ""}
  `
  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? `"CYBERПОЛКА" <noreply@cyberpolka.store>`,
      to,
      replyTo: params.fromEmail,
      subject: `[Поддержка] ${params.subject}`,
      html,
    })
    return true
  } catch (err) {
    console.error("[support] Ошибка отправки письма через SMTP:", err)
    return false
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

/**
 * Заявка на покупку продукта на «Тарифе за размещение» — оператор в расчётах не
 * участвует, покупатель платит напрямую; разработчик должен подтвердить оплату.
 */
export async function notifyListingPurchaseRequested(params: {
  developerTelegramId: string | null
  developerEmail?: string | null
  productTitle: string
  confirmUrl: string
}): Promise<void> {
  const tgText =
    `🧾 <b>Новая заявка на покупку: ${params.productTitle}</b>\n\n` +
    `Покупатель оформил заявку. Получите оплату по вашим реквизитам и подтвердите её — ` +
    `после этого покупателю откроется скачивание.\n${params.confirmUrl}`
  const emailHtml = `
    <h2>🧾 Новая заявка на покупку «${params.productTitle}»</h2>
    <p>Покупатель оформил заявку. Получите оплату по вашим реквизитам и
       <a href="${params.confirmUrl}">подтвердите её</a> — после этого покупателю откроется скачивание.</p>
  `
  await Promise.all([
    params.developerTelegramId ? sendTelegram(params.developerTelegramId, tgText) : Promise.resolve(),
    params.developerEmail
      ? sendEmail(params.developerEmail, `Заявка на покупку: ${params.productTitle}`, emailHtml)
      : Promise.resolve(),
  ])
}

/** Разработчик подтвердил оплату — продукт доступен покупателю. */
export async function notifyListingPurchaseConfirmed(params: {
  buyerTelegramId: string | null
  buyerEmail?: string | null
  productTitle: string
  purchaseUrl: string
}): Promise<void> {
  const tgText =
    `✅ <b>Оплата подтверждена: ${params.productTitle}</b>\n\n` +
    `Разработчик подтвердил оплату. Продукт доступен для скачивания: ${params.purchaseUrl}`
  const emailHtml = `
    <h2>✅ Оплата подтверждена — «${params.productTitle}»</h2>
    <p>Разработчик подтвердил оплату. <a href="${params.purchaseUrl}">Скачать продукт</a>.</p>
  `
  await Promise.all([
    params.buyerTelegramId ? sendTelegram(params.buyerTelegramId, tgText) : Promise.resolve(),
    params.buyerEmail
      ? sendEmail(params.buyerEmail, `Оплата подтверждена: ${params.productTitle}`, emailHtml)
      : Promise.resolve(),
  ])
}

/** Автор не нашёл оплату — покупатель может пожаловаться. */
export async function notifyPurchaseDeclined(params: {
  buyerTelegramId: string | null
  buyerEmail?: string | null
  productTitle: string
  purchaseUrl: string
}): Promise<void> {
  const tg =
    `❗ <b>Оплата не подтверждена: ${params.productTitle}</b>\n\n` +
    `Автор сообщил, что не нашёл вашу оплату. Если вы оплатили — откройте покупку и нажмите «Пожаловаться»: ${params.purchaseUrl}`
  const html = `
    <h2>Оплата не подтверждена — «${params.productTitle}»</h2>
    <p>Автор сообщил, что не нашёл вашу оплату. Если вы оплатили, откройте покупку и нажмите
       «Пожаловаться» — мы разберёмся.</p>
    <p><a href="${params.purchaseUrl}">Открыть покупку</a></p>`
  await Promise.all([
    params.buyerTelegramId ? sendTelegram(params.buyerTelegramId, tg) : Promise.resolve(),
    params.buyerEmail
      ? sendEmail(params.buyerEmail, `Оплата не подтверждена: ${params.productTitle}`, html)
      : Promise.resolve(),
  ])
}

/** Новая заявка на разработку — письмо владельцу (+ подтверждение заказчику). */
export async function notifyNewRequest(params: {
  requestId: string
  task: string
  platform: string
  budget?: string | null
  deadline?: string | null
  contact: string
  messenger?: string | null
  customerEmail?: string | null
}): Promise<void> {
  const supportTo = process.env.SUPPORT_EMAIL ?? "support@cyberpolka.store"
  const adminHtml = `
    <h2>🆕 Новая заявка на разработку</h2>
    <p><b>Что нужно:</b></p>
    <p style="white-space:pre-wrap">${params.task}</p>
    <p><b>Где работает:</b> ${params.platform}</p>
    ${params.deadline ? `<p><b>Срок:</b> ${params.deadline}</p>` : ""}
    ${params.budget ? `<p><b>Бюджет:</b> ${params.budget}</p>` : ""}
    <p><b>Контакт:</b> ${params.contact}${params.messenger ? ` (${params.messenger})` : ""}</p>
    <p><a href="${APP_URL}/admin/requests/${params.requestId}">Открыть заявку в админке</a></p>`

  const tasks: Array<Promise<void>> = [
    sendEmail(supportTo, `Новая заявка: ${params.platform}`, adminHtml),
  ]
  // Подтверждение заказчику, если контакт — email.
  if (params.customerEmail) {
    tasks.push(
      sendEmail(
        params.customerEmail,
        "Заявка принята — CYBERПОЛКА",
        `<h2>Заявка принята</h2>
         <p>Мы получили вашу заявку и ответим в течение 24 часов.</p>
         <p>Номер заявки: ${params.requestId}</p>`,
      ),
    )
  }
  await Promise.all(tasks)
}

/** Передача заявки исполнителю (с контактом заказчика — после согласия, 11.4). */
export async function notifyRequestToExecutor(params: {
  executorContact: string
  task: string
  platform: string
  budget?: string | null
  deadline?: string | null
  customerContact: string
}): Promise<void> {
  if (!params.executorContact.includes("@")) return // контакт не email — письмо не шлём
  const html = `
    <h2>Новая заявка для вас</h2>
    <p><b>Задача:</b></p>
    <p style="white-space:pre-wrap">${params.task}</p>
    <p><b>Где работает:</b> ${params.platform}</p>
    ${params.deadline ? `<p><b>Срок:</b> ${params.deadline}</p>` : ""}
    ${params.budget ? `<p><b>Бюджет:</b> ${params.budget}</p>` : ""}
    <p><b>Контакт заказчика:</b> ${params.customerContact}</p>
    <p>Если готовы взяться — свяжитесь с заказчиком и сообщите оператору.</p>`
  await sendEmail(params.executorContact, `Новая заявка: ${params.platform}`, html)
}

/** Новая жалоба правообладателя — письмо владельцу. */
export async function notifyNewComplaint(params: {
  complaintId: string
  claimant: string
  productUrl?: string | null
}): Promise<void> {
  const supportTo = process.env.SUPPORT_EMAIL ?? "support@cyberpolka.store"
  await sendEmail(
    supportTo,
    "Новая жалоба правообладателя",
    `<h2>⚖️ Жалоба правообладателя</h2>
     <p><b>Заявитель:</b> ${params.claimant}</p>
     ${params.productUrl ? `<p><b>Товар:</b> ${params.productUrl}</p>` : ""}
     <p><a href="${APP_URL}/admin/rights-complaints/${params.complaintId}">Открыть в админке</a></p>
     <p style="color:#888;font-size:12px">Срок реакции по оферте — 24 часа.</p>`,
  )
}

/** Оплачена платная услуга ПОЛКИ — письмо владельцу (ТЗ раздел 11). */
export async function notifyServiceOrderPaid(params: {
  orderId: string
  kind: ServiceKind
}): Promise<void> {
  const supportTo = process.env.SUPPORT_EMAIL ?? "support@cyberpolka.store"
  await sendEmail(
    supportTo,
    `Оплачена услуга: ${SERVICE_LABELS[params.kind]}`,
    `<h2>💳 Оплачена платная услуга</h2>
     <p><b>Услуга:</b> ${SERVICE_LABELS[params.kind]}</p>
     <p><a href="${APP_URL}/admin/services/${params.orderId}">Открыть заказ в админке</a></p>`,
  )
}

/** Отчёт по услуге готов — письмо заказчику. */
export async function notifyServiceReportReady(params: {
  orderId: string
  kind: ServiceKind
  email: string
}): Promise<void> {
  await sendEmail(
    params.email,
    `Отчёт готов: ${SERVICE_LABELS[params.kind]} — CYBERПОЛКА`,
    `<h2>Отчёт готов</h2>
     <p>Отчёт по услуге «${SERVICE_LABELS[params.kind]}» готов.</p>
     <p><a href="${APP_URL}/services/${params.orderId}">Открыть отчёт в личном кабинете</a></p>`,
  )
}

/** Заявка переведена в «Эстафету» — письмо заказчику (ТЗ 12.1). */
export async function notifyRequestRelay(params: { requestId: string; email: string }): Promise<void> {
  await sendEmail(
    params.email,
    "Подбираем замену по вашему проекту — CYBERПОЛКА",
    `<h2>Подбираем замену</h2>
     <p>Мы включили «Эстафету» по вашей заявке и подбираем нового исполнителя из дежурных разработчиков.
     Работа продолжится с вашего репозитория.</p>
     <p>Правила «Эстафеты»: <a href="${APP_URL}/relay">${APP_URL}/relay</a></p>`,
  )
}

/** Заявка закрыта — письмо заказчику с паспортом проекта и чеклистом доступов (ТЗ 12.2/12.4). */
export async function notifyRequestClosed(params: {
  requestId: string
  email: string
  passport: string
}): Promise<void> {
  const checklist = ACCESS_CHECKLIST.map((it) => `<li>${it}</li>`).join("")
  const passportBlock = params.passport.trim()
    ? `<h3>Паспорт проекта</h3>
       <pre style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:8px;font-size:12px">${escapeHtml(params.passport)}</pre>`
    : ""
  await sendEmail(
    params.email,
    "Заявка закрыта — CYBERПОЛКА",
    `<h2>Заявка закрыта</h2>
     <p>Работа сдана. Ниже — паспорт проекта и чеклист по доступам.</p>
     ${passportBlock}
     <h3>Отзовите доступы после сдачи</h3>
     <ul>${checklist}</ul>
     <p style="color:#888;font-size:12px">ПОЛКА паролей не хранит.</p>`,
  )
}

/** Напоминание автору о неподтверждённой заявке (через 24ч). */
export async function notifyPurchaseReminder(params: {
  developerTelegramId: string | null
  developerEmail?: string | null
  productTitle: string
  confirmUrl: string
}): Promise<void> {
  const tg =
    `⏰ <b>Неподтверждённая заявка: ${params.productTitle}</b>\n\n` +
    `Покупатель ждёт подтверждения оплаты более суток. Подтвердите получение или отметьте «Оплаты нет»: ${params.confirmUrl}`
  const html = `
    <h2>Неподтверждённая заявка — «${params.productTitle}»</h2>
    <p>Покупатель ждёт подтверждения оплаты более суток. Подтвердите получение или отметьте, что оплаты нет.</p>
    <p><a href="${params.confirmUrl}">Открыть подтверждения</a></p>`
  await Promise.all([
    params.developerTelegramId ? sendTelegram(params.developerTelegramId, tg) : Promise.resolve(),
    params.developerEmail
      ? sendEmail(params.developerEmail, `Неподтверждённая заявка: ${params.productTitle}`, html)
      : Promise.resolve(),
  ])
}

/** Заявка просрочена (72ч без ответа автора) — уведомляем покупателя и админа. */
export async function notifyPurchaseExpired(params: {
  buyerTelegramId: string | null
  buyerEmail?: string | null
  productTitle: string
  purchaseUrl: string
}): Promise<void> {
  const supportTo = process.env.SUPPORT_EMAIL ?? "support@cyberpolka.store"
  const buyerHtml = `
    <h2>Заявка просрочена — «${params.productTitle}»</h2>
    <p>Автор не подтвердил оплату в течение 72 часов. Если вы оплатили — напишите в поддержку, мы разберёмся.</p>
    <p><a href="${params.purchaseUrl}">Открыть покупку</a></p>`
  await Promise.all([
    params.buyerTelegramId
      ? sendTelegram(params.buyerTelegramId, `⌛ Заявка просрочена: ${params.productTitle}. Автор не подтвердил оплату за 72ч. ${params.purchaseUrl}`)
      : Promise.resolve(),
    params.buyerEmail
      ? sendEmail(params.buyerEmail, `Заявка просрочена: ${params.productTitle}`, buyerHtml)
      : Promise.resolve(),
    sendEmail(
      supportTo,
      `Просрочена заявка: ${params.productTitle}`,
      `<p>Заявка по «${params.productTitle}» просрочена (72 часа без подтверждения автором).</p><p><a href="${params.purchaseUrl}">${params.purchaseUrl}</a></p>`,
    ),
  ])
}

/**
 * Отзыв по безопасности — предупреждение всем покупателям продукта о том, что
 * приобретённый продукт снят с площадки из-за вопросов к безопасности.
 * Текст выверенный: без обвинений, с конкретными действиями.
 */
export async function notifySecurityRecall(params: {
  productTitle: string
  buyers: Array<{ telegramId: string | null; email: string | null }>
}): Promise<void> {
  const supportUrl = `${APP_URL}/support`

  const tgText =
    `⚠️ <b>Важное уведомление о безопасности</b>\n\n` +
    `Продукт «${params.productTitle}», который вы приобрели на CYBERПОЛКЕ, снят с площадки: ` +
    `при проверке к нему возникли вопросы по безопасности.\n\n` +
    `Если вы уже скачивали или запускали его, рекомендуем:\n` +
    `• проверить систему антивирусом;\n` +
    `• если вы вводили пароли или токены от важных сервисов — сменить их;\n` +
    `• при необходимости восстановить данные из резервной копии.\n\n` +
    `Вы можете вернуть средства — напишите в поддержку: ${supportUrl}\n\n` +
    `Приносим извинения за беспокойство. Мы удаляем небезопасные продукты, как только узнаём о проблеме.`

  const emailHtml = `
    <h2>⚠️ Важное уведомление о безопасности</h2>
    <p>Продукт «<b>${params.productTitle}</b>», который вы приобрели на CYBERПОЛКЕ,
       снят с площадки: при проверке к нему возникли вопросы по безопасности.</p>
    <p>Если вы уже скачивали или запускали его, рекомендуем:</p>
    <ul>
      <li>проверить систему антивирусом;</li>
      <li>если вы вводили пароли или токены от важных сервисов — сменить их;</li>
      <li>при необходимости восстановить данные из резервной копии.</li>
    </ul>
    <p>Вы можете вернуть средства — <a href="${supportUrl}">напишите в поддержку</a>.</p>
    <p style="color:#888">Приносим извинения за беспокойство. Мы удаляем небезопасные
       продукты, как только узнаём о проблеме.</p>
  `

  const subject = `Уведомление о безопасности: ${params.productTitle}`

  await Promise.all(
    params.buyers.flatMap((buyer) => [
      buyer.telegramId ? sendTelegram(buyer.telegramId, tgText) : Promise.resolve(),
      buyer.email ? sendEmail(buyer.email, subject, emailHtml) : Promise.resolve(),
    ]),
  )
}

/**
 * Уведомление разработчику о поданной претензии по его продукту.
 * Претензию ведёт поддержка (оператор-посредник), но разработчик должен знать
 * и вправе решить вопрос с покупателем напрямую (возврат — на его стороне).
 */
export async function notifyClaimFiled(params: {
  developerTelegramId: string | null
  developerEmail?: string | null
  productTitle: string
  threadUrl: string
  preview: string
}): Promise<void> {
  const tgText =
    `📩 <b>Претензия по продукту «${params.productTitle}»</b>\n\n` +
    `Покупатель сообщил о проблеме:\n«${params.preview}»\n\n` +
    `Свяжитесь с покупателем и решите вопрос: ${params.threadUrl}\n` +
    `Претензию сопровождает поддержка площадки.`

  const emailHtml = `
    <h2>📩 Претензия по продукту «${params.productTitle}»</h2>
    <p>Покупатель сообщил о проблеме:</p>
    <blockquote style="white-space:pre-wrap">${params.preview}</blockquote>
    <p><a href="${params.threadUrl}">Связаться с покупателем</a>. Претензию сопровождает поддержка площадки.</p>
  `

  await Promise.all([
    params.developerTelegramId ? sendTelegram(params.developerTelegramId, tgText) : Promise.resolve(),
    params.developerEmail
      ? sendEmail(params.developerEmail, `Претензия по продукту: ${params.productTitle}`, emailHtml)
      : Promise.resolve(),
  ])
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

export async function notifyNewQuestion(params: {
  developerTelegramId: string | null
  developerEmail?: string | null
  productTitle: string
  productSlug: string
  question: string
}): Promise<void> {
  const url = `${APP_URL}/product/${params.productSlug}`
  const short = params.question.length > 300 ? params.question.slice(0, 300) + "…" : params.question

  const tgText =
    `❓ <b>Новый вопрос по продукту</b>\n\n` +
    `«${params.productTitle}»\n\n` +
    `${short}\n\n` +
    `Ответьте на странице продукта: ${url}`

  const emailHtml = `
    <h2>❓ Новый вопрос по продукту</h2>
    <p><b>${params.productTitle}</b></p>
    <p style="white-space:pre-wrap">${short}</p>
    <p><a href="${url}">Ответить на странице продукта</a></p>
  `

  await Promise.all([
    params.developerTelegramId ? sendTelegram(params.developerTelegramId, tgText) : Promise.resolve(),
    params.developerEmail ? sendEmail(params.developerEmail, `Новый вопрос: ${params.productTitle}`, emailHtml) : Promise.resolve(),
  ])
}

export async function notifyQuestionAnswered(params: {
  askerTelegramId: string | null
  askerEmail?: string | null
  productTitle: string
  productSlug: string
  answer: string
}): Promise<void> {
  const url = `${APP_URL}/product/${params.productSlug}`
  const short = params.answer.length > 300 ? params.answer.slice(0, 300) + "…" : params.answer

  const tgText =
    `💬 <b>На ваш вопрос ответили</b>\n\n` +
    `«${params.productTitle}»\n\n` +
    `${short}\n\n` +
    `Открыть: ${url}`

  const emailHtml = `
    <h2>💬 На ваш вопрос ответили</h2>
    <p><b>${params.productTitle}</b></p>
    <p style="white-space:pre-wrap">${short}</p>
    <p><a href="${url}">Открыть страницу продукта</a></p>
  `

  await Promise.all([
    params.askerTelegramId ? sendTelegram(params.askerTelegramId, tgText) : Promise.resolve(),
    params.askerEmail ? sendEmail(params.askerEmail, `Ответ на вопрос: ${params.productTitle}`, emailHtml) : Promise.resolve(),
  ])
}

export async function notifyNewMessage(params: {
  recipientTelegramId: string | null
  recipientEmail?: string | null
  productTitle: string
  threadUrl: string
  preview: string
}): Promise<void> {
  const short = params.preview.length > 200 ? params.preview.slice(0, 200) + "…" : params.preview

  const tgText =
    `✉️ <b>Новое сообщение по покупке</b>\n\n` +
    `«${params.productTitle}»\n\n` +
    `${short}\n\n` +
    `Ответить: ${params.threadUrl}`

  const emailHtml = `
    <h2>✉️ Новое сообщение по покупке</h2>
    <p><b>${params.productTitle}</b></p>
    <p style="white-space:pre-wrap">${short}</p>
    <p><a href="${params.threadUrl}">Открыть переписку и ответить</a></p>
  `

  await Promise.all([
    params.recipientTelegramId ? sendTelegram(params.recipientTelegramId, tgText) : Promise.resolve(),
    params.recipientEmail ? sendEmail(params.recipientEmail, `Новое сообщение: ${params.productTitle}`, emailHtml) : Promise.resolve(),
  ])
}

export async function notifyPasswordReset(email: string, resetUrl: string): Promise<void> {
  const emailHtml = `
    <h2>Восстановление пароля</h2>
    <p>Вы запросили сброс пароля на ПОЛКЕ. Ссылка действительна 1 час:</p>
    <p><a href="${resetUrl}">Задать новый пароль</a></p>
    <p style="color:#888;font-size:12px;">Если вы не запрашивали сброс — просто проигнорируйте это письмо, пароль останется прежним.</p>
  `
  await sendEmail(email, "Восстановление пароля — CYBERПОЛКА", emailHtml)
}

export async function notifyEmailVerification(email: string, verifyUrl: string): Promise<void> {
  const emailHtml = `
    <h2>Подтверждение email</h2>
    <p>Подтвердите адрес, чтобы оставлять отзывы и задавать вопросы на ПОЛКЕ:</p>
    <p><a href="${verifyUrl}">Подтвердить email</a></p>
    <p style="color:#888;font-size:12px;">Если вы не регистрировались на ПОЛКЕ — проигнорируйте это письмо.</p>
  `
  await sendEmail(email, "Подтверждение email — CYBERПОЛКА", emailHtml)
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
