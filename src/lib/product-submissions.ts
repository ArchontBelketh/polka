import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"

export class SubmissionConflict extends Error {
  constructor(readonly productId?: string) { super("Эта попытка уже сохранила черновик с другими данными. Откройте сохранённый черновик.") }
}

export async function createProductSubmission(userId: string, id: string, fingerprint: string, data: Prisma.ProductUncheckedCreateInput) {
  const resolve = async (record: { userId: string; productId: string; fingerprint: string }) => {
    if (record.userId !== userId) throw new SubmissionConflict()
    if (record.fingerprint !== fingerprint) throw new SubmissionConflict(record.productId)
    const product = await db.product.findUnique({ where: { id: record.productId } })
    if (!product) throw new SubmissionConflict()
    return { product, created: false }
  }
  const existing = await db.productSubmission.findUnique({ where: { id } })
  if (existing) return resolve(existing)
  try {
    return await db.$transaction(async (tx) => {
      const product = await tx.product.create({ data })
      await tx.productSubmission.create({ data: { id, userId, fingerprint, productId: product.id } })
      return { product, created: true }
    })
  } catch (error) {
    // A duplicate request or lost commit reply is resolved by a read. Do not
    // perform an unkeyed second write when the first result is uncertain.
    const committed = await db.productSubmission.findUnique({ where: { id } }).catch(() => null)
    if (committed) return resolve(committed)
    throw error
  }
}
