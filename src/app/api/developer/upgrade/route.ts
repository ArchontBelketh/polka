import { getCurrentUser } from "@/lib/current-user"
import { db } from "@/lib/db"
import { claimEarlySellerSpot } from "@/lib/early-seller"
import { canManageCode } from "@/lib/permissions"

// Самостоятельный апгрейд покупателя до разработчика.
export async function POST() {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  if (user.role !== "BUYER" && !canManageCode(user.role)) {
    return Response.json({ error: "Недоступно для вашей роли" }, { status: 403 })
  }
  if (canManageCode(user.role)) return Response.json({ ok: true, already: true })

  const enabled = await db.$transaction(async (tx) => {
    // Conditional update preserves a staff role assigned concurrently and
    // prevents enabling a banned account with a previously issued session.
    await tx.user.updateMany({
      where: { id: user.id, role: "BUYER", isBanned: false }, data: { role: "DEVELOPER" },
    })
    const fresh = await tx.user.findUnique({ where: { id: user.id }, select: { role: true, isBanned: true } })
    if (!fresh || fresh.isBanned || !canManageCode(fresh.role)) return false
    await tx.developerPlan.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} })
    await tx.developerProfile.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} })
    return true
  })
  if (!enabled) return Response.json({ error: "Права аккаунта изменились. Обновите страницу." }, { status: 403 })
  // Выдаём место и перки программы «первых продавцов» (если есть свободные).
  await claimEarlySellerSpot(user.id)

  return Response.json({ ok: true, already: canManageCode(user.role) })
}
