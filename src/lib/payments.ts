import { randomUUID } from "crypto"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { createPayment } from "@/lib/tbank"
import { developerPayout } from "@/lib/earnings"
import { payoutHoldThresholdKopecks } from "@/lib/tariffs"
import { notifyNewSale } from "@/lib/notify"
import { fiscalizePurchase, fiscalizeService } from "@/lib/receipts"

const CLAIM_WINDOW_DAYS = parseInt(process.env.CLAIM_WINDOW_DAYS ?? "7", 10)

export type PaymentType = "purchase" | "slots" | "pro" | "ai_review" | "listing_fee"

/**
 * Единая точка создания платежа. Сначала пишем PaymentIntent (что оплачивается),
 * затем создаём платёж в Т-Банке с OrderId = intent.orderId. Т-Банк вернёт этот
 * OrderId в нотификации → вебхук найдёт намерение и выдаст услугу. Чеки бьёт касса
 * (CloudKassir) уже после подтверждения оплаты — см. обработчики ниже.
 */
export async function initPayment(params: {
  type: PaymentType
  payload: Record<string, string>
  amountKopecks: number
  description: string
  returnUrl: string
  userId?: string | null
}): Promise<{ confirmationUrl?: string; paymentId: string; orderId: string }> {
  const orderId = randomUUID()

  const intent = await db.paymentIntent.create({
    data: {
      orderId,
      type: params.type,
      payload: params.payload as Prisma.InputJsonValue,
      amount: params.amountKopecks,
      userId: params.userId ?? null,
      status: "PENDING",
    },
  })

  try {
    const payment = await createPayment({
      amountKopecks: params.amountKopecks,
      description: params.description,
      returnUrl: params.returnUrl,
      // DATA всё ещё шлём (не мешает), но полагаемся на PaymentIntent по OrderId.
      metadata: params.payload,
      idempotencyKey: orderId,
    })
    await db.paymentIntent.update({ where: { id: intent.id }, data: { paymentId: payment.id } })
    return {
      confirmationUrl: payment.confirmation?.confirmation_url,
      paymentId: payment.id,
      orderId,
    }
  } catch (err) {
    await db.paymentIntent
      .update({ where: { id: intent.id }, data: { status: "FAILED" } })
      .catch(() => {})
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Реестр обработчиков: подтверждение платежа выдаёт услугу + бьёт чек по type.
// Добавить новую услугу = добавить ключ в CONFIRM_HANDLERS (+ создавать платёж
// через initPayment с этим type). Вебхук трогать не нужно.
// ─────────────────────────────────────────────────────────────────────────────

interface Intent {
  type: string
  payload: unknown
  amount: number
}
interface Ctx {
  paymentId: string
  amount: number // копейки (из PaymentIntent)
}

type Payload = Record<string, string | undefined>

const CONFIRM_HANDLERS: Record<string, (p: Payload, ctx: Ctx) => Promise<void>> = {
  purchase: fulfillPurchase,
  slots: fulfillSlots,
  pro: fulfillPro,
  ai_review: fulfillAiReview,
  listing_fee: fulfillListingFee,
}

const FAIL_HANDLERS: Record<string, (p: Payload) => Promise<void>> = {
  purchase: failPurchase,
  ai_review: failAiReview,
}

/** Выдать услугу по подтверждённому платежу. */
export async function fulfillPayment(intent: Intent, ctx: { paymentId: string }): Promise<void> {
  const handler = CONFIRM_HANDLERS[intent.type]
  if (!handler) {
    console.warn("fulfillPayment: неизвестный тип платежа", intent.type)
    return
  }
  await handler((intent.payload ?? {}) as Payload, { paymentId: ctx.paymentId, amount: intent.amount })
}

/** Откатить незавершённые записи по неуспешному платежу. */
export async function failPayment(intent: Intent): Promise<void> {
  const handler = FAIL_HANDLERS[intent.type]
  if (handler) await handler((intent.payload ?? {}) as Payload)
}

// Фискализация — fire-and-forget: сбой чека не должен ронять уже оплаченную операцию.
function fiscalizeSafe(p: Promise<void>): void {
  void p.catch((err) => console.error("[receipts] fiscalization error:", err))
}

// ── Обработчики ───────────────────────────────────────────────────────────────

async function fulfillPurchase(p: Payload, ctx: Ctx): Promise<void> {
  const purchaseId = p.purchaseId
  if (!purchaseId) {
    console.error("fulfillPurchase: нет purchaseId в payload")
    return
  }

  const purchase = await db.purchase.findUnique({
    where: { id: purchaseId },
    include: {
      product: { select: { authorId: true, title: true } },
      buyer: { select: { email: true } },
    },
  })
  if (!purchase) {
    console.error("fulfillPurchase: покупка не найдена", purchaseId)
    return
  }
  if (purchase.status !== "PENDING") return // идемпотентность

  const devPlan = await db.developerPlan.findUnique({
    where: { userId: purchase.product.authorId },
    select: { plan: true, proUntil: true },
  })
  const isPro = devPlan?.plan === "PRO" && !!devPlan.proUntil && devPlan.proUntil > new Date()
  const developerAmount = developerPayout(purchase.amount, isPro)

  // Удержание ≥ порога (8.5): дорогие продажи придерживаем до конца окна претензии.
  const now = new Date()
  const hold = purchase.amount >= payoutHoldThresholdKopecks
  const holdUntil = hold ? new Date(now.getTime() + CLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000) : null

  await db.$transaction(async (tx) => {
    await tx.purchase.update({
      where: { id: purchaseId },
      data: {
        status: "PAID",
        paymentId: ctx.paymentId,
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

  // Чек А (агентский, покупателю) + Чек Б (комиссия оператора).
  fiscalizeSafe(fiscalizePurchase(purchaseId, developerAmount))

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

async function fulfillSlots(p: Payload, ctx: Ctx): Promise<void> {
  const { userId, slotsAdded } = p
  if (!userId || !slotsAdded) return
  const slots = parseInt(slotsAdded, 10)
  if (isNaN(slots) || slots <= 0) return

  await db.developerPlan.upsert({
    where: { userId },
    create: { userId, totalSlots: 2 + slots },
    update: { totalSlots: { increment: slots } },
  })

  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } })
  fiscalizeSafe(
    fiscalizeService({
      label: `Дополнительные слоты для размещения (${slots})`,
      amountKopecks: ctx.amount,
      email: user?.email ?? null,
      invoiceId: ctx.paymentId,
    }),
  )
}

async function fulfillPro(p: Payload, ctx: Ctx): Promise<void> {
  const { userId } = p
  if (!userId) return
  const proUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await db.developerPlan.upsert({
    where: { userId },
    create: { userId, plan: "PRO", proUntil },
    update: { plan: "PRO", proUntil },
  })

  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } })
  fiscalizeSafe(
    fiscalizeService({
      label: "Тариф Pro для разработчика (1 месяц)",
      amountKopecks: ctx.amount,
      email: user?.email ?? null,
      invoiceId: ctx.paymentId,
    }),
  )
}

async function fulfillAiReview(p: Payload, ctx: Ctx): Promise<void> {
  const { aiReviewId } = p
  if (!aiReviewId) return
  await db.aiReview.updateMany({
    where: { id: aiReviewId, status: "PENDING" },
    data: { status: "PROCESSING", paymentId: ctx.paymentId },
  })

  const review = await db.aiReview.findUnique({
    where: { id: aiReviewId },
    select: { user: { select: { email: true } }, product: { select: { title: true } } },
  })
  fiscalizeSafe(
    fiscalizeService({
      label: `ИИ-ревью кода «${review?.product.title ?? "продукт"}»`,
      amountKopecks: ctx.amount,
      email: review?.user.email ?? null,
      invoiceId: ctx.paymentId,
    }),
  )
}

async function fulfillListingFee(p: Payload, ctx: Ctx): Promise<void> {
  const { productId } = p
  if (!productId) return
  await db.product.updateMany({
    where: { id: productId, listingFeePaidAt: null },
    data: { listingFeePaidAt: new Date() },
  })

  // Чек В — разработчику за тариф за размещение.
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { title: true, author: { select: { email: true } } },
  })
  fiscalizeSafe(
    fiscalizeService({
      label: `Тариф за размещение продукта «${product?.title ?? ""}»`,
      amountKopecks: ctx.amount,
      email: product?.author.email ?? null,
      invoiceId: ctx.paymentId,
    }),
  )
}

async function failPurchase(p: Payload): Promise<void> {
  if (!p.purchaseId) return
  await db.purchase.updateMany({
    where: { id: p.purchaseId, status: "PENDING" },
    data: { status: "REFUNDED" },
  })
}

async function failAiReview(p: Payload): Promise<void> {
  if (!p.aiReviewId) return
  await db.aiReview.updateMany({
    where: { id: p.aiReviewId, status: "PENDING" },
    data: { status: "FAILED" },
  })
}
