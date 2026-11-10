import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"

export const SIGNAL_LABELS = {
  IMPRESSION: "Показы карточек", PROFILE_OPEN: "Открытия профилей", INVITATION: "Приглашения",
  PROPOSAL: "Первые отклики", SELECTION: "Выбор исполнителя", COMPLETION: "Завершения", DISPUTE: "Заказы со спором",
} as const
export type SignalKind = keyof typeof SIGNAL_LABELS
export const COHORT_LABELS = { FIRST_DEALS: "Без завершённых заказов", RECORDED_DEALS: "С завершёнными заказами" } as const
export const metricsEnabled = () => process.env.EXPOSURE_METRICS_ENABLED === "true"
export const jobSignalKey = (kind: string, entityId: string) => createHash("sha256").update(`business:${kind}:${entityId}`).digest("hex")
const secret = () => process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
function sign(text: string) { return createHmac("sha256", secret()!).update(text).digest("base64url") }
export function seal(value: object) {
  if (!secret()) return null
  const body = Buffer.from(JSON.stringify(value)).toString("base64url")
  return `${body}.${sign(body)}`
}
export function unseal(token: string): Record<string, unknown> | null {
  if (!secret() || token.length > 7000) return null
  const [body, mac, extra] = token.split(".")
  if (!body || !mac || extra) return null
  const expected = Buffer.from(sign(body)), actual = Buffer.from(mac)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  try { const value = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); return value && typeof value === "object" && !Array.isArray(value) ? value : null } catch { return null }
}
export function exposureToken(kind: "IMPRESSION" | "PROFILE_OPEN", ids: string[], now = Date.now()) {
  return metricsEnabled() && ids.length && ids.length <= 20 ? seal({ kind, ids, expires: now + 30 * 60000 }) : null
}
export async function developerCohort(tx: Prisma.TransactionClient, developerId: string, excludeJobId?: string) {
  const count = await tx.jobContract.count({ where: { developerId, ...(excludeJobId ? { jobId: { not: excludeJobId } } : {}), job: { status: "COMPLETED", publicationStatus: "APPROVED", customer: { isBanned: false } } } })
  return count ? "RECORDED_DEALS" : "FIRST_DEALS"
}
// Called inside the business transaction. Stable entity keys count a first
// proposal/selection/completion/disputed job once, including retries and reopenings.
export async function recordJobSignal(tx: Prisma.TransactionClient, kind: Exclude<SignalKind, "IMPRESSION" | "PROFILE_OPEN">, entityId: string, developerId: string, jobId: string) {
  if (!metricsEnabled()) return
  const id = jobSignalKey(kind, entityId)
  if (await tx.exposureEvent.findUnique({ where: { id }, select: { id: true } })) return
  await tx.exposureEvent.create({ data: { id, kind, day: new Date().toISOString().slice(0, 10), cohort: await developerCohort(tx, developerId, jobId) } })
}
export async function recordExposure(kind: "IMPRESSION" | "PROFILE_OPEN", ids: string[], visitor: string, now = new Date()) {
  if (!metricsEnabled() || !secret()) return
  const day = now.toISOString().slice(0, 10)
  // No raw cookie, ID, search query, IP, URL or contact is persisted in this table.
  for (const developerId of new Set(ids)) {
    const id = createHmac("sha256", secret()!).update(`${day}:${kind}:${visitor}:${developerId}`).digest("hex")
    try {
      await db.$transaction(async tx => {
        if (await tx.exposureEvent.findUnique({ where: { id }, select: { id: true } })) return
        const listing = await tx.developerListing.findFirst({ where: { userId: developerId, enabled: true, user: { isBanned: false, role: { in: ["DEVELOPER", "ADMIN"] } } }, select: { userId: true } })
        if (!listing) return
        await tx.exposureEvent.create({ data: { id, kind, day, cohort: await developerCohort(tx, developerId) } })
      })
    } catch (error) {
      // A concurrent delivery or uncertain commit is successful only when the
      // exact deduplication key is actually present after the transaction.
      if (!await db.exposureEvent.findUnique({ where: { id }, select: { id: true } }).catch(() => null)) throw error
    }
  }
}
export async function readExposureReport(days = 30, now = new Date()) {
  const since = new Date(now.getTime() - (days - 1) * 86400000).toISOString().slice(0, 10)
  // Bounded aggregation, not a raw event export. Supported by both DB providers.
  return Promise.all(Object.keys(SIGNAL_LABELS).map(async kind => ({ kind: kind as SignalKind,
    first: await db.exposureEvent.count({ where: { day: { gte: since }, kind, cohort: "FIRST_DEALS" } }),
    recorded: await db.exposureEvent.count({ where: { day: { gte: since }, kind, cohort: "RECORDED_DEALS" } }),
  })))
}
