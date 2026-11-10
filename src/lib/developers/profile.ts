import { createHash } from "node:crypto"
import { db } from "@/lib/db"
import { canManageCode } from "@/lib/permissions"
import { JobError } from "@/lib/jobs/policy"
import type { DeveloperProfileInput } from "@/lib/developer-profile"

export async function saveDeveloperProfile(userId: string, input: DeveloperProfileInput & { listed?: boolean }) {
  return db.$transaction(async tx => {
    const locked = await tx.user.updateMany({ where: { id: userId, isBanned: false, role: { in: ["DEVELOPER", "ADMIN"] } }, data: { updatedAt: new Date() } })
    if (!locked.count) throw new JobError("Аккаунт недоступен для редактирования", 403)
    const actor = await tx.user.findUnique({ where: { id: userId }, select: { role: true, isBanned: true } })
    if (!actor || actor.isBanned || !canManageCode(actor.role)) throw new JobError("Нет доступа", 403)
    const { listed, ...fields } = input
    const complete = fields.headline.length >= 10 && fields.skills.length > 0 && fields.specializations.length > 0
    if (listed && !complete) throw new JobError("Для каталога заполните специализацию в одной строке (от 10 символов), навыки и направления", 422)
    const data = { ...fields, headline: fields.headline || null }
    await tx.developerProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data })
    if (listed !== undefined || !complete) {
      const enabled = listed === true && complete
      if (enabled) await tx.developerListing.upsert({ where: { userId }, create: { userId, enabled, sortKey: createHash("sha256").update(`developer:${userId}`).digest("hex") }, update: { enabled } })
      else await tx.developerListing.updateMany({ where: { userId }, data: { enabled: false } })
    }
  })
}
