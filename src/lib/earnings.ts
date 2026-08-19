import { db } from "@/lib/db"
import { commissionRate } from "@/lib/tariffs"

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
    // Не зачисляем, пока по покупке открыта претензия
    const openClaim = await db.supportTicket.findFirst({
      where: { purchaseId: p.id, category: "CLAIM", status: { in: ["OPEN", "IN_PROGRESS"] } },
      select: { id: true },
    })
    if (openClaim) continue

    const amount = p.developerAmount ?? 0
    await db.$transaction([
      db.purchase.update({ where: { id: p.id }, data: { creditedAt: now } }),
      db.user.update({ where: { id: p.product.authorId }, data: { balance: { increment: amount } } }),
    ])
    released++
  }
  return released
}
