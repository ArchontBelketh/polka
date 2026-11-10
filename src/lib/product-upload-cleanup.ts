import { db } from "@/lib/db"
import { deleteObject } from "@/lib/s3"

export function isOwnedStagingKey(productId: string, type: string, key: string) {
  if (type !== "source" && type !== "screenshot") return false
  const prefix = `staging/products/${productId}/${type}/`
  if (!key.startsWith(prefix)) return false
  const parts = key.slice(prefix.length).split("/")
  return parts.length === 2 && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(parts[0]) && !!parts[1] && !/^[.\s]+$/.test(parts[1])
}

export async function cleanupProductUploads({ apply = false, now = new Date(), limit = 100 } = {}) {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const uploads = await db.productUpload.findMany({ where: { stagingDeletedAt: null, OR: [{ status: "CANCELLED" }, { updatedAt: { lt: cutoff } }] }, orderBy: { createdAt: "asc" }, take: limit })
  const result = { dryRun: !apply, candidates: uploads.length, deleted: 0, skipped: 0, failed: 0 }
  if (!apply) return result
  for (const upload of uploads) {
    if (!isOwnedStagingKey(upload.productId, upload.type, upload.stagingKey)) { result.skipped++; continue }
    try {
      const eligible = await db.$transaction(async (tx) => {
        // Shares the parent lock with preparation/finalization. A recent resume
        // wins over cleanup, and cancellation wins over a stale completion.
        const parent = await tx.product.updateMany({ where: { id: upload.productId }, data: { updatedAt: now } })
        if (!parent.count) return false
        const fresh = await tx.productUpload.findUnique({ where: { id: upload.id } })
        if (!fresh || fresh.stagingDeletedAt || fresh.stagingKey !== upload.stagingKey || (fresh.status !== "CANCELLED" && fresh.updatedAt >= cutoff)) return false
        if (fresh.status === "PENDING") await tx.productUpload.update({ where: { id: upload.id }, data: { status: "CANCELLED" } })
        return true
      })
      if (!eligible) { result.skipped++; continue }
      await deleteObject(upload.stagingKey)
      await db.productUpload.updateMany({ where: { id: upload.id, status: { in: ["COMPLETED", "CANCELLED"] } }, data: { stagingDeletedAt: now } })
      result.deleted++
    } catch { result.failed++ }
  }
  return result
}
