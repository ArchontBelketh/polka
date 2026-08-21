import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { getPayment, verifyNotificationToken } from "@/lib/tbank"
import { developerPayout } from "@/lib/earnings"
import { payoutHoldThresholdKopecks } from "@/lib/tariffs"
import { notifyNewSale } from "@/lib/notify"

const CLAIM_WINDOW_DAYS = parseInt(process.env.CLAIM_WINDOW_DAYS ?? "7", 10)

// Нотификация Т-Банка: подпись проверяется Token'ом (а не белым списком IP).
// Метаданные приходят в DATA. Успех платежа — Status = CONFIRMED.
const FAIL_STATUSES = new Set(["REJECTED", "CANCELED", "DEADLINE_EXPIRED", "AUTH_FAIL"])

export async function POST(req: NextRequest) {
  if (!process.env.TBANK_PASSWORD) {
    console.error("Webhook: TBANK_PASSWORD not set")
    return new Response("Service unavailable", { status: 503 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response("Bad Request", { status: 400 })
  }

  // Диагностика: логируем КАЖДЫЙ входящий вебхук (до проверки токена), чтобы
  // видеть, доходит ли уведомление, с каким статусом и в каком регистре Data.
  console.log(
    `Webhook in: Status=${body.Status} PaymentId=${body.PaymentId} Success=${body.Success} keys=[${Object.keys(body).join(",")}]`,
  )

  if (!verifyNotificationToken(body)) {
    console.warn("Webhook: invalid T-Bank token")
    return new Response("Forbidden", { status: 403 })
  }

  const status = String(body.Status ?? "")
  const paymentId = String(body.PaymentId ?? "")
  // ВАЖНО: в Init объект зовётся DATA, а в нотификации Т-Банк присылает его как Data
  // (регистр отличается). Читаем оба варианта, иначе meta всегда пустой → покупка
  // навсегда зависает в PENDING (деньги списаны, продавец их не видит).
  const meta = (body.Data ?? body.DATA ?? {}) as Record<string, string>
  const metaType = meta.type ?? "purchase"
  const success = body.Success === true || body.Success === "true"

  // T-Bank НЕ возвращает объект DATA в нотификации, поэтому meta.purchaseId
  // обычно пуст. Находим покупку по PaymentId — он сохранён в purchase при
  // создании платежа и это надёжный ключ, не зависящий от эха метаданных.
  let purchaseId = meta.purchaseId as string | undefined
  if (!purchaseId && paymentId) {
    const byPayment = await db.purchase.findFirst({ where: { paymentId }, select: { id: true } })
    purchaseId = byPayment?.id
  }

  if (status === "CONFIRMED" && success) {
    // Повторная проверка статуса через GetState (авторитетный источник)
    let state
    try {
      state = await getPayment(paymentId)
    } catch (err) {
      console.error("Webhook: failed to verify payment", err)
      return new Response("Error", { status: 502 })
    }
    if (state.status !== "CONFIRMED") {
      return new Response("OK", { status: 200 })
    }

    // --- Product purchase ---
    if (metaType === "purchase" || !meta.type) {
      if (!purchaseId) {
        console.error("Webhook: purchase not found for PaymentId", paymentId)
        return new Response("OK", { status: 200 })
      }

      const purchase = await db.purchase.findUnique({
        where: { id: purchaseId },
        include: {
          product: { select: { authorId: true, salesCount: true, title: true } },
          buyer: { select: { email: true } },
        },
      })

      if (!purchase) {
        console.error("Webhook: purchase not found", purchaseId)
        return new Response("OK", { status: 200 })
      }
      if (purchase.status !== "PENDING") {
        return new Response("OK", { status: 200 })
      }

      // Pro-статус разработчика для ставки комиссии
      const devPlan = await db.developerPlan.findUnique({
        where: { userId: purchase.product.authorId },
        select: { plan: true, proUntil: true },
      })
      const isPro = devPlan?.plan === "PRO" && !!devPlan.proUntil && devPlan.proUntil > new Date()
      const developerAmount = developerPayout(purchase.amount, isPro)

      // Удержание ≥ порога (8.5): дорогие продажи придерживаем до конца окна претензии.
      const now = new Date()
      const hold = purchase.amount >= payoutHoldThresholdKopecks
      const holdUntil = hold
        ? new Date(now.getTime() + CLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000)
        : null

      await db.$transaction(async (tx) => {
        await tx.purchase.update({
          where: { id: purchaseId },
          data: {
            status: "PAID",
            paymentId,
            paidAt: now,
            developerAmount,
            holdUntil,
            creditedAt: hold ? null : now,
          },
        })
        await tx.product.update({
          where: { id: purchase.productId },
          data: { salesCount: { increment: 1 } },
        })
        if (!hold) {
          await tx.user.update({
            where: { id: purchase.product.authorId },
            data: { balance: { increment: developerAmount } },
          })
        }
      })

      const developer = await db.user.findUnique({
        where: { id: purchase.product.authorId },
        select: { telegramId: true },
      })
      void notifyNewSale({
        developerTelegramId: developer?.telegramId ?? null,
        productTitle: purchase.product.title,
        amountKopecks: purchase.amount,
        buyerEmail: purchase.buyer.email,
      })
    }

    // --- Slot purchase ---
    if (metaType === "slots") {
      const { userId, slotsAdded } = meta
      if (!userId || !slotsAdded) return new Response("OK", { status: 200 })
      const slots = parseInt(slotsAdded, 10)
      if (isNaN(slots) || slots <= 0) return new Response("OK", { status: 200 })

      await db.developerPlan.upsert({
        where: { userId },
        create: { userId, totalSlots: 2 + slots },
        update: { totalSlots: { increment: slots } },
      })
    }

    // --- Pro subscription ---
    if (metaType === "pro") {
      const { userId } = meta
      if (!userId) return new Response("OK", { status: 200 })
      const proUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      await db.developerPlan.upsert({
        where: { userId },
        create: { userId, plan: "PRO", proUntil },
        update: { plan: "PRO", proUntil },
      })
    }

    // --- AI review ---
    if (metaType === "ai_review") {
      const { aiReviewId } = meta
      if (!aiReviewId) return new Response("OK", { status: 200 })
      await db.aiReview.updateMany({
        where: { id: aiReviewId, status: "PENDING" },
        data: { status: "PROCESSING", paymentId },
      })
    }

    // --- Listing fee (тариф за размещение) ---
    if (metaType === "listing_fee") {
      const { productId } = meta
      if (!productId) return new Response("OK", { status: 200 })
      await db.product.updateMany({
        where: { id: productId, listingFeePaidAt: null },
        data: { listingFeePaidAt: new Date() },
      })
    }
  }

  // Неуспешные статусы — отменяем незавершённые записи
  if (FAIL_STATUSES.has(status)) {
    if (purchaseId) {
      await db.purchase.updateMany({
        where: { id: purchaseId, status: "PENDING" },
        data: { status: "REFUNDED" },
      })
    }
    if (meta.aiReviewId) {
      await db.aiReview.updateMany({
        where: { id: meta.aiReviewId, status: "PENDING" },
        data: { status: "FAILED" },
      })
    }
  }

  return new Response("OK", { status: 200 })
}
