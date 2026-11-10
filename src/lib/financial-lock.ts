import type { Prisma } from "@/generated/prisma/client"

export class FinancialError extends Error {
  constructor(message: string, readonly status = 409) { super(message) }
}

// All reserve/credit/refund paths use this row before changing a seller's funds.
export async function lockDeveloper(tx: Prisma.TransactionClient, developerId: string) {
  const locked = await tx.user.updateMany({ where: { id: developerId }, data: { updatedAt: new Date() } })
  if (!locked.count) throw new FinancialError("Разработчик не найден", 404)
}

export function refundOperationId(purchaseId: string) { return `refund:${purchaseId}` }
export function receiptOperationId(payoutId: string) { return `payout-receipt:${payoutId}` }
