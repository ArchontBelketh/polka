import { db } from "@/lib/db"
import { commissionRate } from "@/lib/tariffs"
import { lockDeveloper, refundOperationId } from "@/lib/financial-lock"

/** Сумма к зачислению разработчику: цена минус комиссия площадки (с учётом Pro). */
export function developerPayout(priceKopecks: number, isPro = false): number {
  return Math.floor(priceKopecks * (1 - commissionRate(isPro)))
}

/**
 * Зачисляет удержанные суммы (≥ порога) по продажам, у которых истёк срок
 * удержания и нет открытой претензии. Возвращает число зачисленных продаж.
 */
export async function releaseExpiredHolds(): Promise<number> {
  const now = new Date()
  const held = await db.purchase.findMany({
    where: {
      status: { in: ["PAID", "DELIVERED"] },
      creditedAt: null,
      holdUntil: { not: null, lte: now },
    },
    select: {
      id: true,
      developerAmount: true,
      product: { select: { authorId: true } },
    },
  })
  if (held.length === 0) return 0

  let released = 0
  for (const p of held) {
    const applied = await db.$transaction(async (tx) => {
      await lockDeveloper(tx, p.product.authorId)
      const purchase = await tx.purchase.findUnique({ where: { id: p.id } })
      if (!purchase || !["PAID", "DELIVERED"].includes(purchase.status) || purchase.creditedAt || !purchase.holdUntil || purchase.holdUntil > now || !purchase.developerAmount || purchase.developerAmount < 0) return false
      const openClaim = await tx.supportTicket.findFirst({ where: { purchaseId: p.id, category: "CLAIM", status: { in: ["OPEN", "IN_PROGRESS"] } }, select: { id: true } })
      if (openClaim || await tx.financialOperation.findUnique({ where: { id: refundOperationId(p.id) } })) return false
      const changed = await tx.purchase.updateMany({ where: { id: p.id, creditedAt: null, status: { in: ["PAID", "DELIVERED"] }, holdUntil: { lte: now } }, data: { creditedAt: now } })
      if (!changed.count) return false
      await tx.user.update({ where: { id: p.product.authorId }, data: { balance: { increment: purchase.developerAmount } } })
      return true
    })
    if (applied) released++
  }
  return released
}
