import { randomUUID } from "crypto"
import { Prisma } from "@/generated/prisma/client"
import { db, databaseProvider } from "@/lib/db"
import { createPayment, type TBankReceipt } from "@/lib/tbank"
import { developerPayout } from "@/lib/earnings"
import { payoutHoldThresholdKopecks } from "@/lib/tariffs"
import { notifyNewSale, notifyServiceOrderPaid } from "@/lib/notify"
import { hasAgentReceiptData, normalizePhone } from "@/lib/payout-profile"
import { deleteObject } from "@/lib/s3"

const CLAIM_WINDOW_DAYS = parseInt(process.env.CLAIM_WINDOW_DAYS ?? "7", 10)

// Фискализация оператора (ИП, УСН «Доходы», ФФД 1.2). Касса CloudKassir привязана
// к терминалу — чек передаём в Receipt внутри Init, касса печатает его сама.
const RECEIPT_TAXATION = process.env.RECEIPT_TAXATION ?? "usn_income"
const RECEIPT_VAT = process.env.RECEIPT_VAT ?? "none"
// Признак предмета расчёта ТОВАРА — "property_rights" (передача имущественного
// права, ФФД 1.2). Собственные услуги оператора остаются "service" (см. ниже).
const RECEIPT_PRODUCT_OBJECT = process.env.RECEIPT_PRODUCT_PAYMENT_OBJECT ?? "property_rights"

const OWN_SERVICE_TYPES = new Set<string>(["slots", "pro", "ai_review", "listing_fee", "service_order"])

export type PaymentType = "purchase" | "slots" | "pro" | "ai_review" | "listing_fee" | "service_order"

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
      .updateMany({ where: { id: intent.id, status: "PENDING" }, data: { status: "FAILED" } })
      .catch(() => {})
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Реестр обработчиков: подтверждение платежа выдаёт услугу по type.
// (Чек уже пробит кассой при оплате — здесь только выдача услуги.)
// ─────────────────────────────────────────────────────────────────────────────

type Payload = Record<string, string | undefined>
type Tx = Prisma.TransactionClient
type AfterCommit = () => Promise<unknown>
type Handler = (tx: Tx, payload: Payload, paymentId: string) => Promise<AfterCommit[]>

const CONFIRM_HANDLERS: Record<string, Handler> = {
  purchase: fulfillPurchase,
  slots: fulfillSlots,
  pro: fulfillPro,
  ai_review: fulfillAiReview,
  listing_fee: fulfillListingFee,
  service_order: fulfillServiceOrder,
}

const FAIL_HANDLERS: Record<string, Handler> = {
  purchase: failPurchase,
  ai_review: failAiReview,
  service_order: failServiceOrder,
}

/**
 * Единая точка применения проверенного результата Т-Банка (webhook и recheck).
 * Блокировка строки сериализует конкурирующие события, а выдача услуги и статус
 * фиксируются одной транзакцией. При ошибке обработчика откатывается всё.
 */
export async function applyPaymentOutcome(
  intentId: string,
  paymentId: string,
  outcome: "CONFIRMED" | "FAILED",
): Promise<{ applied: boolean }> {
  const result = await db.$transaction(async (tx) => {
    // PostgreSQL locks the row. YDB uses serializable OCC and retries the whole
    // transaction after ABORTED; reading and updating the intent is the guard.
    if (databaseProvider !== "ydb") {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "PaymentIntent" WHERE "id" = ${intentId} FOR UPDATE
      `
      if (locked.length === 0) throw new Error("Payment intent not found")
    }
    const intent = await tx.paymentIntent.findUniqueOrThrow({ where: { id: intentId } })
    if (intent.paymentId && intent.paymentId !== paymentId) {
      throw new Error("Payment does not match intent")
    }
    // Финальный успешный результат не откатывается запоздалым отказом.
    if (intent.status === "CONFIRMED" || intent.status === outcome) {
      return { applied: false, effects: [] as AfterCommit[] }
    }

    const handler = (outcome === "CONFIRMED" ? CONFIRM_HANDLERS : FAIL_HANDLERS)[intent.type]
    if (outcome === "CONFIRMED" && !handler) throw new Error("Unknown payment type")
    const effects = handler ? await handler(tx, (intent.payload ?? {}) as Payload, paymentId) : []
    await tx.paymentIntent.update({
      where: { id: intentId },
      data: { status: outcome, paymentId },
    })
    return { applied: true, effects }
  })

  // Сеть и best-effort очистка S3 не держат блокировку и не откатывают оплату.
  await Promise.allSettled(result.effects.map((effect) => effect()))
  return { applied: result.applied }
}

// ── Обработчики ───────────────────────────────────────────────────────────────

async function fulfillPurchase(tx: Tx, p: Payload, paymentId: string): Promise<AfterCommit[]> {
  const purchaseId = p.purchaseId
  if (!purchaseId) {
    throw new Error("Purchase ID missing from payment")
  }

  const purchase = await tx.purchase.findUnique({
    where: { id: purchaseId },
    include: {
      product: { select: { authorId: true, title: true } },
      buyer: { select: { email: true } },
    },
  })
  if (!purchase) {
    throw new Error("Purchase not found")
  }
  if (purchase.status === "PAID" || purchase.status === "DELIVERED") return []
  if (purchase.status !== "PENDING") throw new Error("Purchase cannot be fulfilled in its current state")

  const devPlan = await tx.developerPlan.findUnique({
    where: { userId: purchase.product.authorId },
    select: { plan: true, proUntil: true },
  })
  const isPro = devPlan?.plan === "PRO" && !!devPlan.proUntil && devPlan.proUntil > new Date()
  const developerAmount = developerPayout(purchase.amount, isPro)

  const now = new Date()
  const hold = purchase.amount >= payoutHoldThresholdKopecks
  const holdUntil = hold ? new Date(now.getTime() + CLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000) : null

  const claimed = await tx.purchase.updateMany({
    where: { id: purchaseId, status: "PENDING" },
    data: {
      status: "PAID",
      paymentId,
      paidAt: now,
      developerAmount,
      holdUntil,
      creditedAt: hold ? null : now,
    },
  })
  if (claimed.count === 0) return []
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

  const developer = await tx.user.findUnique({
    where: { id: purchase.product.authorId },
    select: { telegramId: true },
  })
  return [() => notifyNewSale({
    developerTelegramId: developer?.telegramId ?? null,
    productTitle: purchase.product.title,
    amountKopecks: purchase.amount,
    buyerEmail: purchase.buyer.email,
  })]
}

async function fulfillSlots(tx: Tx, p: Payload): Promise<AfterCommit[]> {
  const { userId, slotsAdded } = p
  if (!userId || !slotsAdded) throw new Error("Slot payment payload is incomplete")
  const slots = parseInt(slotsAdded, 10)
  if (!/^[1-9]\d*$/.test(slotsAdded) || !Number.isSafeInteger(slots) || slots <= 0) throw new Error("Invalid slot count")

  await tx.developerPlan.upsert({
    where: { userId },
    create: { userId, totalSlots: 2 + slots },
    update: { totalSlots: { increment: slots } },
  })
  return []
}

async function fulfillPro(tx: Tx, p: Payload): Promise<AfterCommit[]> {
  const { userId } = p
  if (!userId) throw new Error("Pro payment user is missing")
  const proUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await tx.developerPlan.upsert({
    where: { userId },
    create: { userId, plan: "PRO", proUntil },
    update: { plan: "PRO", proUntil },
  })
  return []
}

async function fulfillAiReview(tx: Tx, p: Payload, paymentId: string): Promise<AfterCommit[]> {
  const { aiReviewId } = p
  if (!aiReviewId) throw new Error("AI review payment ID is missing")
  await tx.aiReview.updateMany({
    where: { id: aiReviewId, status: "PENDING" },
    data: { status: "PROCESSING", paymentId },
  })
  return []
}

async function fulfillListingFee(tx: Tx, p: Payload): Promise<AfterCommit[]> {
  const { productId } = p
  if (!productId) throw new Error("Listing payment product is missing")
  await tx.product.updateMany({
    where: { id: productId, listingFeePaidAt: null },
    data: { listingFeePaidAt: new Date() },
  })
  return []
}

async function failPurchase(tx: Tx, p: Payload): Promise<AfterCommit[]> {
  if (!p.purchaseId) throw new Error("Purchase ID missing from payment")
  await tx.purchase.updateMany({
    where: { id: p.purchaseId, status: "PENDING" },
    data: { status: "REFUNDED" },
  })
  return []
}

async function failAiReview(tx: Tx, p: Payload): Promise<AfterCommit[]> {
  if (!p.aiReviewId) throw new Error("AI review payment ID is missing")
  await tx.aiReview.updateMany({
    where: { id: p.aiReviewId, status: "PENDING" },
    data: { status: "FAILED" },
  })
  return []
}

// Платные услуги ПОЛКИ (раздел 11): оплата переводит заказ в «Оплачен».
// AI_AUDIT далее подхватит крон и выполнит аудит; экспертные услуги ведёт оператор.
async function fulfillServiceOrder(tx: Tx, p: Payload, paymentId: string): Promise<AfterCommit[]> {
  const { serviceOrderId } = p
  if (!serviceOrderId) throw new Error("Service order payment ID is missing")
  const res = await tx.serviceOrder.updateMany({
    where: { id: serviceOrderId, status: "AWAITING_PAYMENT" },
    data: { status: "PAID", paymentId, paidAt: new Date() },
  })
  if (res.count === 0) return []
  const order = await tx.serviceOrder.findUnique({
    where: { id: serviceOrderId },
    select: { id: true, kind: true },
  })
  return order ? [() => notifyServiceOrderPaid({ orderId: order.id, kind: order.kind })] : []
}

async function failServiceOrder(tx: Tx, p: Payload): Promise<AfterCommit[]> {
  if (!p.serviceOrderId) throw new Error("Service order payment ID is missing")
  // Неоплаченный заказ не занимает место — удаляем вместе с прикреплённым кодом.
  const order = await tx.serviceOrder.findFirst({
    where: { id: p.serviceOrderId, status: "AWAITING_PAYMENT" },
    select: { id: true, codeS3Key: true },
  })
  if (!order) return []
  await tx.serviceOrder.delete({ where: { id: order.id } })
  const key = order.codeS3Key
  return key ? [() => deleteObject(key)] : []
}
