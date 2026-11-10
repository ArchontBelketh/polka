import { db } from "@/lib/db"
import { getPayment, createRefund } from "@/lib/tbank"
import { saleModelForKopecks } from "@/lib/tariffs"
import { FinancialError, lockDeveloper, refundOperationId } from "@/lib/financial-lock"

const PAID = ["PAID", "DELIVERED"] as const
const pending = { ok: false, pending: true, message: "Результат возврата ещё не подтверждён. Повторная проверка сверит статус в банке без нового списания." }

async function prepareRefund(purchaseId: string, actorId: string) {
  const initial = await db.purchase.findUnique({ where: { id: purchaseId }, select: { product: { select: { authorId: true } } } })
  if (!initial) throw new FinancialError("Покупка не найдена", 404)
  return db.$transaction(async (tx) => {
    await lockDeveloper(tx, initial.product.authorId)
    const purchase = await tx.purchase.findUnique({ where: { id: purchaseId }, include: { product: true, payout: true } })
    if (!purchase) throw new FinancialError("Покупка не найдена", 404)
    const operation = await tx.financialOperation.findUnique({ where: { id: refundOperationId(purchaseId) } })
    if (operation) return operation
    if (purchase.status === "REFUNDED") return null
    if (!(PAID as readonly string[]).includes(purchase.status)) throw new FinancialError("Возврат недоступен для этого статуса", 400)
    if (!purchase.paymentId) throw new FinancialError("У покупки нет банковского платежа для возврата", 400)
    if ((purchase.product.saleModel ?? saleModelForKopecks(purchase.amount)) !== "COMMISSION") throw new FinancialError("Возврат через площадку доступен только для модели «Комиссия»", 400)
    if (!Number.isSafeInteger(purchase.amount) || purchase.amount <= 0) throw new FinancialError("Сумма покупки требует сверки")
    if (purchase.developerAmount !== null && (!Number.isSafeInteger(purchase.developerAmount) || purchase.developerAmount < 0 || purchase.developerAmount > purchase.amount)) throw new FinancialError("Начисление по покупке требует сверки")
    if (purchase.creditedAt && purchase.developerAmount === null) throw new FinancialError("Начисление по покупке требует сверки")
    if (await tx.purchase.count({ where: { paymentId: purchase.paymentId } }) !== 1) throw new FinancialError("Банковский платёж связан с несколькими покупками. Нужна сверка.")
    if (purchase.payout && purchase.payout.status !== "PAID" && purchase.payout.status !== "REJECTED") throw new FinancialError("Продажа включена в незавершённую выплату. Сначала разберите выплату.")
    return tx.financialOperation.create({ data: {
      id: refundOperationId(purchaseId), kind: "REFUND", referenceId: purchaseId,
      amount: purchase.amount, actorId, providerId: purchase.paymentId,
      payload: { developerId: purchase.product.authorId },
    } })
  })
}

async function applyConfirmedRefund(operationId: string) {
  const initial = await db.financialOperation.findUnique({ where: { id: operationId } })
  if (!initial) throw new FinancialError("Операция возврата не найдена", 404)
  const developerId = (initial.payload as { developerId: string }).developerId
  await db.$transaction(async (tx) => {
    await lockDeveloper(tx, developerId)
    const operation = await tx.financialOperation.findUnique({ where: { id: operationId } })
    if (operation?.status === "APPLIED") return
    if (operation?.status !== "CONFIRMED") throw new FinancialError("Банк ещё не подтвердил полный возврат")
    const purchase = await tx.purchase.findUnique({ where: { id: operation.referenceId }, include: { product: { select: { authorId: true } } } })
    if (!purchase || purchase.product.authorId !== developerId || purchase.amount !== operation.amount || purchase.paymentId !== operation.providerId) throw new FinancialError("Данные покупки изменились. Нужна сверка возврата.")
    const changed = await tx.purchase.updateMany({ where: { id: purchase.id, status: { in: [...PAID] }, paymentId: operation.providerId, amount: operation.amount }, data: { status: "REFUNDED" } })
    if (!changed.count) throw new FinancialError("Статус покупки изменился. Нужна сверка возврата.")
    await tx.product.updateMany({ where: { id: purchase.productId, salesCount: { gt: 0 } }, data: { salesCount: { decrement: 1 } } })
    if (purchase.creditedAt && purchase.developerAmount) await tx.user.update({ where: { id: developerId }, data: { balance: { decrement: purchase.developerAmount } } })
    await tx.supportTicket.updateMany({ where: { purchaseId: purchase.id, category: "CLAIM", status: { in: ["OPEN", "IN_PROGRESS"] } }, data: { status: "RESOLVED" } })
    await tx.financialOperation.update({ where: { id: operationId }, data: { status: "APPLIED", appliedAt: new Date() } })
  })
}

/** At most one Cancel send. Every later invocation only reads the bank state. */
export async function refundPurchase(purchaseId: string, actorId: string) {
  const operation = await prepareRefund(purchaseId, actorId)
  if (!operation || operation.status === "APPLIED") return { ok: true, pending: false }
  if (operation.status === "CONFIRMED") { await applyConfirmedRefund(operation.id); return { ok: true, pending: false } }
  const claimed = await db.financialOperation.updateMany({ where: { id: operation.id, status: "PREPARED" }, data: { status: "IN_FLIGHT" } })
  let providerStatus = "UNKNOWN"
  try {
    let state = await getPayment(operation.providerId!)
    if (state.id !== operation.providerId) throw new Error("Payment identity mismatch")
    providerStatus = state.status
    if (claimed.count && state.status === "CONFIRMED") {
      if (state.amount !== operation.amount) throw new Error("Payment amount mismatch")
      state = await createRefund(operation.providerId!, operation.amount)
      if (state.id !== operation.providerId) throw new Error("Refund identity mismatch")
      providerStatus = state.status
    }
    if (providerStatus !== "REFUNDED") {
      await db.financialOperation.updateMany({ where: { id: operation.id, status: { in: ["IN_FLIGHT", "UNKNOWN"] } }, data: { status: "UNKNOWN", providerStatus } })
      return pending
    }
    await db.financialOperation.updateMany({ where: { id: operation.id, status: { in: ["IN_FLIGHT", "UNKNOWN"] } }, data: { status: "CONFIRMED", providerStatus } })
  } catch {
    await db.financialOperation.updateMany({ where: { id: operation.id, status: { in: ["IN_FLIGHT", "UNKNOWN"] } }, data: { status: "UNKNOWN", providerStatus } }).catch(() => {})
    return pending
  }
  await applyConfirmedRefund(operation.id)
  return { ok: true, pending: false }
}
