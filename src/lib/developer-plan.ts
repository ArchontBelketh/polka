import { db } from "@/lib/db"

export { SLOT_PACKAGES, PRO_AMOUNT_KOPECKS } from "@/lib/developer-plan-constants"

export interface PlanInfo {
  plan: "FREE" | "PRO"
  totalSlots: number
  usedSlots: number
  availableSlots: number
  proUntil: Date | null
  isProActive: boolean
}

export async function getPlanInfo(userId: string): Promise<PlanInfo> {
  const [devPlan, usedSlots] = await Promise.all([
    db.developerPlan.findUnique({ where: { userId } }),
    db.product.count({
      where: { authorId: userId, status: { in: ["PENDING", "APPROVED", "SUSPENDED"] } },
    }),
  ])

  const totalSlots = devPlan?.totalSlots ?? 2
  const plan = devPlan?.plan ?? "FREE"
  const proUntil = devPlan?.proUntil ?? null
  const isProActive = plan === "PRO" && proUntil !== null && proUntil > new Date()

  return {
    plan: isProActive ? "PRO" : "FREE",
    totalSlots: isProActive ? Infinity : totalSlots,
    usedSlots,
    availableSlots: isProActive ? Infinity : Math.max(0, totalSlots - usedSlots),
    proUntil,
    isProActive,
  }
}

export async function hasAvailableSlot(userId: string): Promise<boolean> {
  const info = await getPlanInfo(userId)
  return info.isProActive || info.availableSlots > 0
}

export async function ensurePlanRecord(userId: string): Promise<void> {
  await db.developerPlan.upsert({
    where: { userId },
    create: { userId },
    update: {},
  })
}
