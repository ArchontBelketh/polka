import { db } from "@/lib/db"
import { saleModelForKopecks } from "@/lib/tariffs"
import { FinancialError, lockDeveloper, refundOperationId } from "@/lib/financial-lock"

const CLAIM_WINDOW_DAYS = parseInt(process.env.CLAIM_WINDOW_DAYS ?? "7", 10)

export async function filePurchaseClaim(buyerId: string, purchaseId: string, text: string) {
  const initial = await db.purchase.findUnique({ where: { id: purchaseId }, select: { buyerId: true, product: { select: { authorId: true } } } })
  if (!initial) throw new FinancialError("Покупка не найдена", 404)
  if (initial.buyerId !== buyerId) throw new FinancialError("Нет доступа", 403)
  return db.$transaction(async (tx) => {
    await lockDeveloper(tx, initial.product.authorId)
    const purchase = await tx.purchase.findUnique({ where: { id: purchaseId }, include: { product: { include: { author: { select: { telegramId: true, email: true } } } } } })
    if (!purchase || purchase.buyerId !== buyerId) throw new FinancialError("Нет доступа", 403)
    if (!["PAID", "DELIVERED"].includes(purchase.status)) throw new FinancialError("Претензию можно подать только по оплаченной покупке", 400)
    if ((purchase.product.saleModel ?? saleModelForKopecks(purchase.amount)) !== "COMMISSION") throw new FinancialError("По этому продукту вопросы решаются напрямую с разработчиком.", 400)
    const deadline = new Date((purchase.paidAt ?? purchase.createdAt).getTime() + CLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    if (new Date() > deadline) throw new FinancialError(`Срок подачи претензии истёк (${CLAIM_WINDOW_DAYS} дней с момента покупки)`, 400)
    const existing = await tx.supportTicket.findFirst({ where: { purchaseId, category: "CLAIM" }, select: { id: true } })
    if (existing) return { created: false, ticketId: existing.id }
    if (await tx.financialOperation.findUnique({ where: { id: refundOperationId(purchaseId) } })) throw new FinancialError("По покупке уже оформляется возврат. Обратитесь в поддержку.")
    const ticket = await tx.supportTicket.create({ data: {
      authorId: buyerId, subject: `Претензия: ${purchase.product.title}`, category: "CLAIM", productId: purchase.productId, purchaseId,
      messages: { create: { authorId: buyerId, text, isStaff: false } },
    } })
    return { created: true, ticketId: ticket.id, notice: { developerTelegramId: purchase.product.author.telegramId, developerEmail: purchase.product.author.email, productTitle: purchase.product.title } }
  })
}
