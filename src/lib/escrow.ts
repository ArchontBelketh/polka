import { db } from "@/lib/db"

const ESCROW_DAYS = parseInt(process.env.ESCROW_DAYS ?? "7", 10)
const COMMISSION_RATE = parseFloat(process.env.COMMISSION_RATE ?? "0.20")

export function escrowUntilDate(): Date {
  const d = new Date()
  d.setDate(d.getDate() + ESCROW_DAYS)
  return d
}

export function developerPayout(priceKopecks: number): number {
  return Math.floor(priceKopecks * (1 - COMMISSION_RATE))
}

// Releases escrow for all purchases where escrowUntil has passed.
// Sets status to DELIVERED and credits the developer's balance.
// Returns the number of purchases released.
export async function releaseExpiredEscrow(): Promise<number> {
  const now = new Date()
  const purchases = await db.purchase.findMany({
    where: { status: "PAID", escrowUntil: { lte: now } },
    include: { product: { select: { authorId: true } } },
  })

  if (purchases.length === 0) return 0

  await db.$transaction(async (tx) => {
    for (const purchase of purchases) {
      const payout = developerPayout(purchase.amount)
      await tx.purchase.update({
        where: { id: purchase.id },
        data: { status: "DELIVERED" },
      })
      await tx.user.update({
        where: { id: purchase.product.authorId },
        data: { balance: { increment: payout } },
      })
    }
  })

  return purchases.length
}
