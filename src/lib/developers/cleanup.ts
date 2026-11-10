import { db } from "@/lib/db"

// Explicit bounded deletion; default callers only inspect the plan. Events have
// no business/FK dependants. Job history, invitations and listings are retained.
export async function cleanupExposureEvents({ apply = false, now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - 31 * 86400000)
  const expired = await db.exposureEvent.findMany({ where: { createdAt: { lt: cutoff } }, select: { id: true }, orderBy: { createdAt: "asc" }, take: 1000 })
  const deleted = apply && expired.length ? (await db.exposureEvent.deleteMany({ where: { id: { in: expired.map(row => row.id) }, createdAt: { lt: cutoff } } })).count : 0
  return { apply, cutoff: cutoff.toISOString(), candidates: expired.length, deleted, morePossible: expired.length === 1000 }
}
