import { randomUUID } from "crypto"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { createPayment, type TBankReceipt } from "@/lib/tbank"
import { developerPayout } from "@/lib/earnings"
import { payoutHoldThresholdKopecks } from "@/lib/tariffs"
import { notifyNewSale } from "@/lib/notify"
import { hasAgentReceiptData, normalizePhone } from "@/lib/payout-profile"

const CLAIM_WINDOW_DAYS = parseInt(process.env.CLAIM_WINDOW_DAYS ?? "7", 10)

// Фискализация оператора (ИП, УСН «Доходы», ФФД 1.2). Касса CloudKassir привязана
// к терминалу — чек передаём в Receipt внутри Init, касса печатает его сама.
const RECEIPT_TAXATION = process.env.RECEIPT_TAXATION ?? "usn_income"
const RECEIPT_VAT = process.env.RECEIPT_VAT ?? "none"
// Признак предмета расчёта товара: "service" валиден везде; "property_rights"
// (передача имущ. права) — по согласованию с бухгалтером/кассой.
const RECEIPT_PRODUCT_OBJECT = process.env.RECEIPT_PRODUCT_PAYMENT_OBJECT ?? "service"

const OWN_SERVICE_TYPES = new Set<string>(["slots", "pro", "ai_review", "listing_fee"])

export type PaymentType = "purchase" | "slots" | "pro" | "ai_review" | "listing_fee"

/** Обычный чек за услугу оператора: одна позиция, продавец — оператор. */
function buildServiceReceipt(name: string, amountKopecks: number, email: string): TBankReceipt {
  return {
    Email: email,
    Taxation: RECEIPT_TAXATION,
    Items: [
      {
        Name: name.slice(0, 128),
        Price: amountKopecks,
        Quantity: 1,
        Amount: amountKopecks,
        Tax: RECEIPT_VAT,
        PaymentMethod: "full_payment",
        PaymentObject: "service",
        MeasurementUnit: "шт",
      },
    ],
  }
}

/**
 * Агентский чек покупателю за Продукт (Чек А, оферта 3.2/8.7). Оператор —
 * поверенный (attorney), поставщик — Разработчик (ИНН/наименование/телефон).
 * Т-Банк требует SupplierInfo.Phones при агентском признаке → телефон обязателен.
 * null, если данных поставщика нет (тогда чек не сформировать).
 */
async function buildPurchaseAgentReceipt(purchaseId: string): Promise<TBankReceipt | null> {
  const purchase = await db.purchase.findUnique({
    where: { id: purchaseId },
    select: {
      amount: true,
      buyer: { select: { email: true } },
      product: { select: { title: true, author: { select: { payoutProfile: true } } } },
    },
  })
  if (!purchase) return null

  const profile = purchase.product.author.payoutProfile
  if (!hasAgentReceiptData(profile)) return null
  const phone = normalizePhone(profile!.phone!)
  const email = purchase.buyer.email
  if (!phone || !email) return null

  return {
    Email: email,
    Taxation: RECEIPT_TAXATION, // СНО оператора (кассу держит оператор)
    Items: [
      {
        Name: purchase.product.title.slice(0, 128),
        Price: purchase.amount,
        Quantity: 1,
        Amount: purchase.amount,
        Tax: RECEIPT_VAT,
        PaymentMethod: "full_payment",
        PaymentObject: RECEIPT_PRODUCT_OBJECT,
        MeasurementUnit: "шт",
        AgentData: { AgentSign: "attorney" },
        SupplierInfo: {
          Phones: [phone],
          Name: profile!.displayName.slice(0, 200),
          Inn: profile!.inn,
        },
      },
    ],
  }
}

/**
 * Единая точка создания платежа. Пишем PaymentIntent (что оплачивается), затем
 * создаём платёж в Т-Банке с OrderId = intent.orderId и Receipt (для кассы).
 * Вебхук по OrderId найдёт намерение и выдаст услугу.
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
    // Чек для кассы: собственные услуги — обычный; покупка товара — агентский.
    let receipt: TBankReceipt | undefined
    if (OWN_SERVICE_TYPES.has(params.type) && params.userId) {
      const user = await db.user.findUnique({
        where: { id: params.userId },
        select: { email: true },
      })
      if (user?.email) receipt = buildServiceReceipt(params.description, params.amountKopecks, user.email)
    } else if (params.type === "purchase" && params.payload.purchaseId) {
      receipt = (await buildPurchaseAgentReceipt(params.payload.purchaseId)) ?? undefined
    }

    const payment = await createPayment({
      amountKopecks: params.amountKopecks,
      description: params.description,
      returnUrl: params.returnUrl,
      metadata: params.payload,
      idempotencyKey: orderId,
      receipt,
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
// Реестр обработчиков: подтверждение платежа выдаёт услугу по type.
// (Чек уже пробит кассой при оплате — здесь только выдача услуги.)
// ─────────────────────────────────────────────────────────────────────────────

interface Intent {
  type: string
  payload: unknown
  amount: number
}
interface Ctx {
  paymentId: string
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
export async function fulfillPayment(intent: Intent, ctx: Ctx): Promise<void> {
  const handler = CONFIRM_HANDLERS[intent.type]
  if (!handler) {
    console.warn("fulfillPayment: неизвестный тип платежа", intent.type)
    return
  }
  await handler((intent.payload ?? {}) as Payload, ctx)
}

/** Откатить незавершённые записи по неуспешному платежу. */
export async function failPayment(intent: Intent): Promise<void> {
  const handler = FAIL_HANDLERS[intent.type]
  if (handler) await handler((intent.payload ?? {}) as Payload)
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

async function fulfillSlots(p: Payload): Promise<void> {
  const { userId, slotsAdded } = p
  if (!userId || !slotsAdded) return
  const slots = parseInt(slotsAdded, 10)
  if (isNaN(slots) || slots <= 0) return

  await db.developerPlan.upsert({
    where: { userId },
    create: { userId, totalSlots: 2 + slots },
    update: { totalSlots: { increment: slots } },
  })
}

async function fulfillPro(p: Payload): Promise<void> {
  const { userId } = p
  if (!userId) return
  const proUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await db.developerPlan.upsert({
    where: { userId },
    create: { userId, plan: "PRO", proUntil },
    update: { plan: "PRO", proUntil },
  })
}

async function fulfillAiReview(p: Payload, ctx: Ctx): Promise<void> {
  const { aiReviewId } = p
  if (!aiReviewId) return
  await db.aiReview.updateMany({
    where: { id: aiReviewId, status: "PENDING" },
    data: { status: "PROCESSING", paymentId: ctx.paymentId },
  })
}

async function fulfillListingFee(p: Payload): Promise<void> {
  const { productId } = p
  if (!productId) return
  await db.product.updateMany({
    where: { id: productId, listingFeePaidAt: null },
    data: { listingFeePaidAt: new Date() },
  })
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
