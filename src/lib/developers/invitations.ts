import { db } from "@/lib/db"
import { JobError, type JobActor } from "@/lib/jobs/policy"
import { lockJob } from "@/lib/jobs/service"
import { recordJobSignal } from "./metrics"

export async function inviteDeveloper(actor: JobActor, jobId: string, developerId: string) {
  return db.$transaction(async tx => {
    const locked = await lockJob(tx, jobId, actor), { job } = locked
    if (job.customerId !== locked.actor.id) throw new JobError("Приглашать может только заказчик", 403)
    if (developerId === actor.id) throw new JobError("Нельзя пригласить себя", 422)
    // Serialize the account-wide daily budget across different orders too.
    const account = await tx.user.updateMany({ where: { id: actor.id, isBanned: false }, data: { updatedAt: new Date() } })
    if (!account.count) throw new JobError("Аккаунт недоступен", 403)
    const old = await tx.jobInvitation.findUnique({ where: { jobId_developerId: { jobId, developerId } } })
    if (old) return { jobId, notificationIds: [] as string[] }
    if (job.publicationStatus !== "APPROVED" || job.status !== "OPEN" || job.deadline <= new Date() || job.contract) throw new JobError("Приглашения доступны для опубликованного заказа с открытыми откликами")
    const listing = await tx.developerListing.findFirst({ where: { userId: developerId, enabled: true, user: { isBanned: false, role: { in: ["DEVELOPER", "ADMIN"] }, developerProfile: { availability: { in: ["AVAILABLE", "LIMITED"] }, specializations: { has: job.specialization } } } }, select: { userId: true } })
    if (!listing) throw new JobError("Исполнитель сейчас недоступен или не указал это направление", 409)
    if (await tx.jobInvitation.count({ where: { jobId } }) >= 10) throw new JobError("На один заказ можно пригласить до 10 разработчиков", 429)
    if (await tx.jobInvitation.count({ where: { job: { customerId: actor.id }, createdAt: { gte: new Date(Date.now() - 86400000) } } }) >= 20) throw new JobError("Можно отправить до 20 приглашений за 24 часа", 429)
    const invitation = await tx.jobInvitation.create({ data: { jobId, developerId } })
    await recordJobSignal(tx, "INVITATION", invitation.id, developerId, jobId)
    // Private recipient IDs never enter the public status log or metrics payload.
    const notification = await tx.jobNotification.create({ data: { jobId, userId: developerId, text: "Вас пригласили откликнуться на заказ" } })
    return { jobId, notificationIds: [notification.id] }
  })
}
