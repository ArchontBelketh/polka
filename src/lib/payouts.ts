import { db } from "@/lib/db"
import { sendKktReceipt, getKktReceiptStatus, type KktReceiptInput } from "@/lib/cloudkassir"
import { FinancialError, lockDeveloper, receiptOperationId, refundOperationId } from "@/lib/financial-lock"
import type { Prisma } from "@/generated/prisma/client"

const rub = (kopecks: number) => Number((kopecks / 100).toFixed(2))
const uncertainReceipt = { ok: false, pending: true, message: "Результат отправки чека неизвестен. Проверьте кассу; повторная отправка автоматически не выполняется." }

/** Reserve all eligible sales once, under the seller's balance lock. */
export async function createPayoutForDeveloper(developerId: string): Promise<{ id: string; amount: number } | { error: string }> {
  return db.$transaction(async (tx) => {
    await lockDeveloper(tx, developerId)
    const developer = await tx.user.findUnique({ where: { id: developerId } })
    if (!developer || developer.isBanned || developer.payoutsFrozen || !["DEVELOPER", "ADMIN"].includes(developer.role)) return { error: "Выплаты по этому аккаунту недоступны" }
    const eligible = await tx.purchase.findMany({ where: {
      product: { authorId: developerId }, creditedAt: { not: null }, payoutId: null,
      developerAmount: { not: null }, status: { in: ["PAID", "DELIVERED"] },
    }, select: { id: true, developerAmount: true } })
    const ids = eligible.map((purchase) => purchase.id)
    const total = eligible.reduce((sum, purchase) => sum + (purchase.developerAmount ?? 0), 0)
    if (!ids.length || total <= 0) return { error: "Нет средств к выплате" }
    if (eligible.some((purchase) => !Number.isSafeInteger(purchase.developerAmount) || (purchase.developerAmount ?? 0) <= 0)) return { error: "Суммы продаж требуют сверки перед выплатой" }
    if (!Number.isSafeInteger(total) || total > 2_147_483_647 || total > developer.balance) return { error: "Баланс и продажи требуют сверки перед выплатой" }
    const refunds = await tx.financialOperation.count({ where: { id: { in: ids.map(refundOperationId) } } })
    const claims = await tx.supportTicket.count({ where: { purchaseId: { in: ids }, category: "CLAIM", status: { in: ["OPEN", "IN_PROGRESS"] } } })
    if (refunds || claims) return { error: "По продажам есть возврат или открытая претензия. Сначала завершите разбор." }
    const payout = await tx.payout.create({ data: { developerId, amount: total, status: "PENDING" } })
    const claimed = await tx.purchase.updateMany({ where: { id: { in: ids }, payoutId: null, status: { in: ["PAID", "DELIVERED"] } }, data: { payoutId: payout.id } })
    if (claimed.count !== ids.length) throw new FinancialError("Состав продаж изменился. Повторите запрос.")
    await tx.user.update({ where: { id: developerId }, data: { balance: { decrement: total } } })
    return { id: payout.id, amount: total }
  })
}

/** Records a manual transfer; this function never sends money to the seller. */
export async function transitionPayout(payoutId: string, next: "PROCESSING" | "PAID" | "REJECTED", actorId: string) {
  const initial = await db.payout.findUnique({ where: { id: payoutId } })
  if (!initial) throw new FinancialError("Запрос на выплату не найден", 404)
  return db.$transaction(async (tx) => {
    await lockDeveloper(tx, initial.developerId)
    const payout = await tx.payout.findUnique({ where: { id: payoutId }, include: {
      developer: { select: { email: true, payoutsFrozen: true } },
      purchases: { select: { id: true, status: true, developerAmount: true, product: { select: { title: true } } } },
    } })
    if (!payout) throw new FinancialError("Запрос на выплату не найден", 404)
    if (payout.status === next) return { applied: false, status: next }
    if (!["PENDING", "PROCESSING"].includes(payout.status) || (payout.status === "PROCESSING" && next === "PROCESSING")) throw new FinancialError("Статус выплаты уже изменился. Обновите страницу.")
    if (next !== "REJECTED" && payout.developer.payoutsFrozen) throw new FinancialError("Выплаты по аккаунту приостановлены", 403)
    const changed = await tx.payout.updateMany({ where: { id: payoutId, status: payout.status }, data: { status: next, ...(next === "PAID" ? { paidAt: new Date() } : {}) } })
    if (!changed.count) throw new FinancialError("Статус выплаты уже изменился. Обновите страницу.")
    if (next === "REJECTED") {
      await tx.purchase.updateMany({ where: { payoutId }, data: { payoutId: null } })
      await tx.user.update({ where: { id: payout.developerId }, data: { balance: { increment: payout.amount } } })
    }
    if (next === "PAID" && !payout.receiptSent) {
      if (!payout.purchases.length || payout.purchases.some((purchase) => !["PAID", "DELIVERED"].includes(purchase.status) || !purchase.developerAmount || purchase.developerAmount < 0) || payout.purchases.reduce((sum, purchase) => sum + (purchase.developerAmount ?? 0), 0) !== payout.amount) throw new FinancialError("Состав выплаты требует сверки перед подтверждением")
      if (await tx.financialOperation.count({ where: { id: { in: payout.purchases.map((purchase) => refundOperationId(purchase.id)) } } })) throw new FinancialError("По продаже оформляется возврат. Выплату нужно разобрать.")
      if (await tx.supportTicket.count({ where: { purchaseId: { in: payout.purchases.map((purchase) => purchase.id) }, category: "CLAIM", status: { in: ["OPEN", "IN_PROGRESS"] } } })) throw new FinancialError("По продаже открыта претензия. Выплату нужно разобрать.")
      const payload: KktReceiptInput = {
        type: "Expense", ...(payout.developer.email ? { email: payout.developer.email } : {}),
        items: payout.purchases.map((purchase) => ({ label: purchase.product.title.slice(0, 128), price: rub(purchase.developerAmount!), quantity: 1, amount: rub(purchase.developerAmount!), vat: null, method: 4, object: 14, additionalPositionInfo: `Покупка ${purchase.id}` })),
        taxationSystem: 1, amountRub: rub(payout.amount), invoiceId: payout.id,
      }
      await tx.financialOperation.create({ data: { id: receiptOperationId(payoutId), kind: "PAYOUT_RECEIPT", referenceId: payoutId, actorId, amount: payout.amount, payload: payload as unknown as Prisma.InputJsonValue } })
    }
    return { applied: true, status: next }
  })
}

/** A queued receipt is not a fiscalized receipt. Later requests only query its ID. */
export async function fiscalizePayout(payoutId: string): Promise<{ ok: boolean; pending?: boolean; message?: string }> {
  const payout = await db.payout.findUnique({ where: { id: payoutId } })
  if (!payout || payout.status !== "PAID") return { ok: false, message: "Выплата ещё не отмечена как выполненная" }
  if (payout.receiptSent) return { ok: true }
  const id = receiptOperationId(payoutId)
  let operation = await db.financialOperation.findUnique({ where: { id } })
  // Legacy PAID entries may already have an external receipt. Never resend them.
  if (!operation) return { ok: false, message: "Историческая выплата: статус чека нужно сверить в кассе вручную" }
  if (operation.status === "APPLIED") return { ok: true }
  const claimed = await db.financialOperation.updateMany({ where: { id, status: "PREPARED" }, data: { status: "IN_FLIGHT" } })
  if (claimed.count) {
    try {
      const result = await sendKktReceipt(operation.payload as unknown as KktReceiptInput, id)
      if (!result.ok || !result.receiptId) {
        await db.financialOperation.updateMany({ where: { id, status: "IN_FLIGHT" }, data: { status: "UNKNOWN" } })
        return uncertainReceipt
      }
      await db.financialOperation.updateMany({ where: { id, status: { in: ["IN_FLIGHT", "UNKNOWN"] } }, data: { status: "CONFIRMED", providerId: result.receiptId, providerStatus: "Queued" } })
    } catch {
      await db.financialOperation.updateMany({ where: { id, status: "IN_FLIGHT" }, data: { status: "UNKNOWN" } }).catch(() => {})
      return uncertainReceipt
    }
    operation = await db.financialOperation.findUnique({ where: { id } })
  }
  if (!operation?.providerId) return uncertainReceipt
  let providerStatus: string
  try { providerStatus = await getKktReceiptStatus(operation.providerId) } catch { return uncertainReceipt }
  if (providerStatus !== "Processed") {
    await db.financialOperation.updateMany({ where: { id, status: "CONFIRMED" }, data: { providerStatus } })
    return { ok: false, pending: providerStatus === "Queued", message: providerStatus === "Queued" ? "Чек принят в очередь кассы. Проверьте статус позже." : "Касса сообщила об ошибке чека. Требуется ручная сверка." }
  }
  await db.$transaction(async (tx) => {
    await lockDeveloper(tx, payout.developerId)
    const fresh = await tx.financialOperation.findUnique({ where: { id } })
    if (fresh?.status === "APPLIED") return
    if (fresh?.providerId !== operation!.providerId) throw new FinancialError("Идентификатор чека изменился. Нужна сверка.")
    await tx.payout.update({ where: { id: payoutId }, data: { receiptSent: true } })
    await tx.financialOperation.update({ where: { id }, data: { status: "APPLIED", providerStatus: "Processed", appliedAt: new Date() } })
  })
  return { ok: true }
}
