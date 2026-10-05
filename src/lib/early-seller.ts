import { db } from "@/lib/db"

// Программа «первых продавцов»: первые N разработчиков получают расширенные
// перки. Значения можно переопределить через env.
export const EARLY_SELLER_TOTAL = Number(process.env.EARLY_SELLER_TOTAL ?? 50)
export const EARLY_SELLER_SLOTS = 5
export const EARLY_SELLER_PRO_MONTHS = 2
export const EARLY_SELLER_BADGE = "Пионер"

export interface EarlySellerStats {
  total: number
  taken: number
  left: number
}

export async function getEarlySellerStats(): Promise<EarlySellerStats> {
  const taken = await db.user.count({ where: { isEarlySeller: true } })
  return { total: EARLY_SELLER_TOTAL, taken, left: Math.max(0, EARLY_SELLER_TOTAL - taken) }
}

function laterOf(a: Date | null, b: Date): Date {
  return a && a > b ? a : b
}

/**
 * Идемпотентно закрепляет за разработчиком место в программе и выдаёт перки:
 * 5 слотов и Pro на 2 месяца. Не укорачивает уже активный Pro и не уменьшает
 * докупленные слоты. Если мест не осталось или это не разработчик — ничего не делает.
 */
export async function claimEarlySellerSpot(
  userId: string,
): Promise<{ claimed: boolean; number?: number }> {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { isEarlySeller: true, role: true, earlySellerNo: true },
    })
    if (!user) return { claimed: false }
    if (user.isEarlySeller) return { claimed: true, number: user.earlySellerNo ?? undefined }
    if (user.role !== "DEVELOPER") return { claimed: false }

    const taken = await tx.user.count({ where: { isEarlySeller: true } })
    if (taken >= EARLY_SELLER_TOTAL) return { claimed: false } // мест нет

    const number = taken + 1
    await tx.user.update({
      where: { id: userId },
      data: { isEarlySeller: true, earlySellerNo: number },
    })

    const plan = await tx.developerPlan.findUnique({ where: { userId } })
    const proFromNow = new Date()
    proFromNow.setMonth(proFromNow.getMonth() + EARLY_SELLER_PRO_MONTHS)
    const totalSlots = Math.max(plan?.totalSlots ?? 2, EARLY_SELLER_SLOTS)
    const proUntil = laterOf(plan?.proUntil ?? null, proFromNow)

    await tx.developerPlan.upsert({
      where: { userId },
      create: { userId, totalSlots: EARLY_SELLER_SLOTS, plan: "PRO", proUntil },
      update: { totalSlots, plan: "PRO", proUntil },
    })

    return { claimed: true, number }
  })
}
