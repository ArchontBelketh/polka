import { db } from "@/lib/db"
import type { Prisma, Job, JobContract } from "@/generated/prisma/client"
import { submissionFingerprint } from "@/lib/submission-fingerprint"
import { canManageCode, isStaff } from "@/lib/permissions"
import { recordJobSignal } from "@/lib/developers/metrics"
import { ACTIVE_JOB_STATUSES, canReadWorkspace, JobError, validateJobDeadline, type JobActor, type JobFields, type JobCommand } from "./policy"

type Tx = Prisma.TransactionClient
export type LockedJob = Job & { contract: JobContract | null }

export async function requireActor(tx: Tx, actor: JobActor) {
  const fresh = await tx.user.findUnique({ where: { id: actor.id }, select: { id: true, role: true, isBanned: true } })
  if (!fresh || fresh.isBanned) throw new JobError("Аккаунт недоступен", 403)
  return fresh
}
export async function lockJob(tx: Tx, jobId: string, actor: JobActor) {
  const locked = await tx.job.updateMany({ where: { id: jobId }, data: { updatedAt: new Date() } })
  if (!locked.count) throw new JobError("Заказ не найден", 404)
  const fresh = await requireActor(tx, actor)
  const job = await tx.job.findUnique({ where: { id: jobId }, include: { contract: true } })
  if (!job) throw new JobError("Заказ не найден", 404)
  return { job, actor: fresh }
}
async function event(tx: Tx, job: Job, actor: JobActor, action: string, reason?: string, data?: Prisma.InputJsonValue, proposalId?: string) {
  await tx.jobStatusLog.create({ data: { jobId: job.id, actorId: actor.id, action, fromStatus: job.status, reason, ...(data ? { data } : {}), proposalId } })
}
async function notice(tx: Tx, job: Job, ids: string[], text: string) {
  const result: string[] = []
  for (const userId of new Set(ids)) result.push((await tx.jobNotification.create({ data: { jobId: job.id, userId, text } })).id)
  return result
}
const participantIds = (job: LockedJob, actorId: string) => [job.customerId, job.contract?.developerId].filter((id): id is string => !!id && id !== actorId)
function owner(job: Job, actor: JobActor) { if (job.customerId !== actor.id) throw new JobError("Нет доступа", 403) }
function member(job: LockedJob, actor: JobActor) { if (!job.contract || ![job.customerId, job.contract.developerId].includes(actor.id)) throw new JobError("Нет доступа", 403) }
function staff(actor: JobActor) { if (!isStaff(actor.role)) throw new JobError("Только для модератора", 403) }
function live(job: Job) { if (job.publicationStatus !== "APPROVED") throw new JobError("Заказ сейчас скрыт или не опубликован") }
function unchanged(job: Job, revision: number) { if (job.revision !== revision) throw new JobError("Заказ изменился. Обновите страницу.") }

export async function createJob(actor: JobActor, id: string, fields: JobFields) {
  const hash = submissionFingerprint({ ...fields, deadline: fields.deadline.toISOString() })
  const existing = await db.job.findUnique({ where: { id } })
  const resolve = (job: Job) => { if (job.customerId !== actor.id || job.submissionHash !== hash) throw new JobError("Этот идентификатор создания уже использован"); return { jobId: job.id, created: false, notificationIds: [] as string[] } }
  if (existing) return resolve(existing)
  validateJobDeadline(fields.deadline)
  try {
    return await db.$transaction(async (tx) => {
      await requireActor(tx, actor)
      await tx.job.create({ data: { id, customerId: actor.id, submissionHash: hash, ...fields } })
      await tx.jobStatusLog.create({ data: { jobId: id, actorId: actor.id, action: "CREATE" } })
      return { jobId: id, created: true, notificationIds: [] as string[] }
    })
  } catch (error) {
    const committed = await db.job.findUnique({ where: { id } }).catch(() => null)
    if (committed) return resolve(committed)
    throw error
  }
}

export async function saveProposal(actor: JobActor, jobId: string, input: { amount: number; durationDays: number; approach: string; revision: number }) {
  return db.$transaction(async (tx) => {
    const locked = await lockJob(tx, jobId, actor); actor = locked.actor; const { job } = locked
    if (!canManageCode(actor.role)) throw new JobError("Включите режим разработчика, чтобы откликнуться", 403)
    if (job.customerId === actor.id) throw new JobError("Нельзя откликнуться на свой заказ", 403)
    live(job)
    if (job.status !== "OPEN" || job.deadline <= new Date()) throw new JobError("Приём откликов закрыт")
    if ((await tx.user.findUnique({ where: { id: job.customerId }, select: { isBanned: true } }))?.isBanned) throw new JobError("Заказ недоступен", 404)
    const old = await tx.jobProposal.findUnique({ where: { jobId_developerId: { jobId, developerId: actor.id } } })
    if (old?.status === "ACTIVE" && old.amount === input.amount && old.durationDays === input.durationDays && old.approach === input.approach) return { jobId, notificationIds: [] as string[] }
    if ((old?.revision ?? 0) !== input.revision) throw new JobError("Отклик изменился. Обновите страницу.")
    const data = { amount: input.amount, durationDays: input.durationDays, approach: input.approach, status: "ACTIVE" as const }
    if (!old && await tx.jobProposal.count({ where: { jobId } }) >= 200) throw new JobError("Достигнут лимит откликов для этого заказа")
    const proposal = old ? await tx.jobProposal.update({ where: { id: old.id }, data: { ...data, revision: { increment: 1 } } }) : await tx.jobProposal.create({ data: { jobId, developerId: actor.id, ...data } })
    if (!old) await recordJobSignal(tx, "PROPOSAL", proposal.id, actor.id, jobId)
    await event(tx, job, actor, old ? "PROPOSAL_EDIT" : "PROPOSAL_CREATE", undefined, { amount: proposal.amount, durationDays: proposal.durationDays, approach: proposal.approach, revision: proposal.revision }, proposal.id)
    return { jobId, notificationIds: await notice(tx, job, [job.customerId], old ? "Исполнитель обновил отклик" : "Новый отклик на заказ") }
  })
}

export async function runJobCommand(actor: JobActor, jobId: string, command: JobCommand) {
  return db.$transaction(async (tx) => {
    const locked = await lockJob(tx, jobId, actor); actor = locked.actor; const { job } = locked
    let recipients = participantIds(job, actor.id), text = "Статус заказа изменился"
    let data: Prisma.JobUpdateInput = {}, reason: string | undefined
    const done = (notificationIds: string[] = []) => ({ jobId, notificationIds })
    switch (command.action) {
      case "EDIT":
        owner(job, actor); unchanged(job, command.revision)
        if (job.status !== "OPEN" || !["DRAFT", "REJECTED"].includes(job.publicationStatus) || job.contract) throw new JobError("Редактирование закрыто. Опубликованные условия сохраняются.")
        validateJobDeadline(command.fields.deadline)
        data = { ...command.fields }; break
      case "SUBMIT":
        owner(job, actor)
        if (job.publicationStatus === "PENDING") return done()
        unchanged(job, command.revision)
        if (!["DRAFT", "REJECTED"].includes(job.publicationStatus) || job.status !== "OPEN") throw new JobError("Заказ нельзя отправить на модерацию")
        validateJobDeadline(job.deadline); data = { publicationStatus: "PENDING", moderationReason: null }; break
      case "APPROVE": case "REJECT": case "SUSPEND": case "RESTORE":
        staff(actor); unchanged(job, command.revision); reason = command.reason
        if (command.action === "RESTORE") {
          if (job.publicationStatus !== "SUSPENDED") throw new JobError("Заказ не скрыт")
          data = { publicationStatus: "APPROVED", moderationReason: reason }
        } else if (command.action === "SUSPEND") {
          if (job.publicationStatus !== "APPROVED") throw new JobError("Заказ уже скрыт или не опубликован")
          data = { publicationStatus: "SUSPENDED", moderationReason: reason }
        } else {
          if (job.publicationStatus !== "PENDING" || job.status !== "OPEN") throw new JobError("Заказ уже рассмотрен")
          if (command.action === "APPROVE") validateJobDeadline(job.deadline)
          data = { publicationStatus: command.action === "APPROVE" ? "APPROVED" : "REJECTED", moderationReason: reason, ...(command.action === "APPROVE" ? { publishedAt: new Date() } : {}) }
        }
        recipients = [job.customerId]; text = command.action === "APPROVE" ? "Заказ опубликован" : "Модератор обновил статус заказа"; break
      case "WITHDRAW": {
        const proposal = await tx.jobProposal.findUnique({ where: { jobId_developerId: { jobId, developerId: actor.id } } })
        if (!proposal) throw new JobError("Отклик не найден", 404)
        if (proposal.status === "WITHDRAWN") return done()
        if (job.status !== "OPEN" || proposal.status !== "ACTIVE" || proposal.revision !== command.revision) throw new JobError("Отклик уже изменился или выбран")
        await tx.jobProposal.update({ where: { id: proposal.id }, data: { status: "WITHDRAWN", revision: { increment: 1 } } })
        await event(tx, job, actor, command.action, undefined, { revision: proposal.revision + 1 }, proposal.id)
        return done(await notice(tx, job, [job.customerId], "Исполнитель отозвал отклик"))
      }
      case "SELECT": {
        owner(job, actor); live(job)
        if (job.contract?.proposalId === command.proposalId) return done()
        if (job.status !== "OPEN" || job.contract || job.deadline <= new Date()) throw new JobError("Исполнитель уже выбран или заказ закрыт")
        const proposal = await tx.jobProposal.findUnique({ where: { id: command.proposalId }, include: { developer: { select: { role: true, isBanned: true } } } })
        if (!proposal || proposal.jobId !== jobId || proposal.status !== "ACTIVE" || proposal.revision !== command.proposalRevision || proposal.developer.isBanned || !canManageCode(proposal.developer.role)) throw new JobError("Отклик изменился или исполнитель недоступен")
        await tx.jobContract.create({ data: { jobId, customerId: job.customerId, developerId: proposal.developerId, proposalId: proposal.id, title: job.title, description: job.description, outcome: job.outcome, specialization: job.specialization, amount: proposal.amount, durationDays: proposal.durationDays, approach: proposal.approach, dueAt: new Date(Date.now() + proposal.durationDays * 86400000) } })
        await recordJobSignal(tx, "SELECTION", jobId, proposal.developerId, jobId)
        await tx.jobProposal.updateMany({ where: { jobId, status: "ACTIVE" }, data: { status: "DECLINED" } })
        await tx.jobProposal.update({ where: { id: proposal.id }, data: { status: "SELECTED" } })
        data = { status: "EXECUTOR_SELECTED" }; recipients = [proposal.developerId]; text = "Вас выбрали исполнителем заказа"; break
      }
      case "MESSAGE": {
        if (!canReadWorkspace(job, actor) || !job.contract) throw new JobError("Рабочая область недоступна", 404)
        if (["COMPLETED", "CANCELLED"].includes(job.status)) throw new JobError("Переписка завершённого заказа доступна для чтения")
        const old = await tx.jobMessage.findUnique({ where: { id: command.id } })
        if (old) { if (old.jobId !== jobId || old.senderId !== actor.id || old.text !== command.text) throw new JobError("Идентификатор сообщения уже использован"); return done() }
        await tx.jobMessage.create({ data: { id: command.id, jobId, senderId: actor.id, text: command.text } })
        return done(await notice(tx, job, participantIds(job, actor.id), "Новое сообщение в рабочей области"))
      }
      case "DELIVER": {
        member(job, actor); live(job)
        if (job.contract!.developerId !== actor.id) throw new JobError("Результат сдаёт исполнитель", 403)
        const old = await tx.jobDelivery.findUnique({ where: { id: command.id } })
        if (old) { if (old.jobId !== jobId || old.developerId !== actor.id || old.text !== command.text || JSON.stringify(old.attachmentIds) !== JSON.stringify(command.attachmentIds)) throw new JobError("Идентификатор сдачи уже использован"); return done() }
        if (job.status !== "IN_PROGRESS" || job.cancellationRequestedBy) throw new JobError("Сейчас нельзя сдать работу")
        if (new Set(command.attachmentIds).size !== command.attachmentIds.length || await tx.jobAttachment.count({ where: { id: { in: command.attachmentIds }, jobId, authorId: actor.id } }) !== command.attachmentIds.length) throw new JobError("Выберите свои файлы из этого заказа", 422)
        await tx.jobDelivery.create({ data: { id: command.id, jobId, developerId: actor.id, text: command.text, attachmentIds: command.attachmentIds } })
        data = { status: "ACCEPTANCE" }; text = "Исполнитель сдал результат на приёмку"; break
      }
      case "ACCEPT": case "REVISION": {
        owner(job, actor); live(job)
        const delivery = await tx.jobDelivery.findUnique({ where: { id: command.deliveryId } })
        if (!delivery || delivery.jobId !== jobId) throw new JobError("Сдача не найдена", 404)
        if ((command.action === "ACCEPT" && delivery.status === "ACCEPTED" && job.status === "COMPLETED") || (command.action === "REVISION" && delivery.status === "CHANGES_REQUESTED" && job.status === "IN_PROGRESS")) return done()
        if (job.status !== "ACCEPTANCE" || delivery.status !== "PENDING" || job.cancellationRequestedBy) throw new JobError("Состояние приёмки изменилось")
        reason = command.action === "REVISION" ? command.reason : undefined
        await tx.jobDelivery.update({ where: { id: delivery.id }, data: { status: command.action === "ACCEPT" ? "ACCEPTED" : "CHANGES_REQUESTED", customerFeedback: reason, reviewedAt: new Date() } })
        if (command.action === "ACCEPT") await recordJobSignal(tx, "COMPLETION", jobId, job.contract!.developerId, jobId)
        data = { status: command.action === "ACCEPT" ? "COMPLETED" : "IN_PROGRESS", ...(command.action === "ACCEPT" ? { completedAt: new Date() } : {}) }
        text = command.action === "ACCEPT" ? "Заказчик принял результат" : "Заказчик запросил доработку"; break
      }
      case "REVIEW": {
        member(job, actor)
        if (job.status !== "COMPLETED") throw new JobError("Отзыв доступен только после приёмки результата", 403)
        const old = await tx.jobReview.findUnique({ where: { jobId_authorId: { jobId, authorId: actor.id } } })
        if (old) { if (old.rating !== command.rating || old.text !== command.text) throw new JobError("Отзыв по этому заказу уже опубликован"); return done() }
        const recipientId = actor.id === job.customerId ? job.contract!.developerId : job.customerId
        await tx.jobReview.create({ data: { jobId, authorId: actor.id, recipientId, rating: command.rating, text: command.text } })
        await event(tx, job, actor, "REVIEW")
        return done(await notice(tx, job, [recipientId], "Участник заказа оставил отзыв"))
      }
      case "START":
        member(job, actor); live(job)
        if (actor.id !== job.contract!.developerId) throw new JobError("Работу начинает исполнитель", 403)
        if (job.status === "IN_PROGRESS") return done()
        if (job.status !== "EXECUTOR_SELECTED" || job.cancellationRequestedBy) throw new JobError("Сейчас нельзя начать работу")
        data = { status: "IN_PROGRESS" }; text = "Исполнитель начал работу"; break
      case "CANCEL":
        ownerOrMember(job, actor); reason = command.reason
        if (job.status === "CANCELLED") return done()
        if (job.status === "OPEN" && !job.contract) { owner(job, actor); data = { status: "CANCELLED", ...(job.publicationStatus === "PENDING" ? { publicationStatus: "DRAFT" } : {}) }; break }
        if (!ACTIVE_JOB_STATUSES.includes(job.status)) throw new JobError("Для этого статуса отмена недоступна")
        if (job.cancellationRequestedBy) return done()
        data = { cancellationRequestedBy: actor.id, cancellationReason: reason }; text = "Участник предложил отменить заказ"; break
      case "WITHDRAW_CANCEL": case "CONFIRM_CANCEL": case "DECLINE_CANCEL":
        member(job, actor)
        if (!ACTIVE_JOB_STATUSES.includes(job.status) || !job.cancellationRequestedBy) throw new JobError("Запрос отмены уже рассмотрен")
        if ((command.action === "WITHDRAW_CANCEL") !== (job.cancellationRequestedBy === actor.id)) throw new JobError("Это действие доступно другой стороне", 403)
        data = { cancellationRequestedBy: null, cancellationReason: null, ...(command.action === "CONFIRM_CANCEL" ? { status: "CANCELLED" } : {}) }; text = "Запрос отмены рассмотрен"; break
      case "DISPUTE": {
        member(job, actor); reason = command.reason
        if (job.status === "DISPUTED") return done()
        if (!ACTIVE_JOB_STATUSES.includes(job.status)) throw new JobError("Спор открывается по действующему заказу")
        const old = await tx.jobDispute.findUnique({ where: { jobId } })
        let ticketId = old?.ticketId
        if (!ticketId) ticketId = (await tx.supportTicket.create({ data: { authorId: actor.id, subject: `Спор по заказу: ${job.title.slice(0, 140)}`, category: "OTHER", messages: { create: { authorId: actor.id, text: reason } } } })).id
        else { await tx.supportTicket.update({ where: { id: ticketId }, data: { status: "IN_PROGRESS" } }); await tx.ticketMessage.create({ data: { ticketId, authorId: actor.id, text: reason } }) }
        await tx.jobDispute.upsert({ where: { jobId }, create: { jobId, ticketId, previousStatus: job.status, openedById: actor.id, reason }, update: { previousStatus: job.status, openedById: actor.id, reason, resolution: null, resolvedById: null, resolvedAt: null } })
        if (!old) await recordJobSignal(tx, "DISPUTE", jobId, job.contract!.developerId, jobId)
        data = { status: "DISPUTED", cancellationRequestedBy: null, cancellationReason: null }; text = "По заказу открыт спор; подключена поддержка"; break
      }
      case "RESUME": case "RESOLVE_CANCEL": {
        staff(actor); reason = command.reason
        if (job.status !== "DISPUTED") throw new JobError("Спор уже рассмотрен")
        const dispute = await tx.jobDispute.findUnique({ where: { jobId } })
        if (!dispute || dispute.resolvedAt) throw new JobError("Спор уже рассмотрен")
        await tx.jobDispute.update({ where: { jobId }, data: { resolution: reason, resolvedAt: new Date(), resolvedById: actor.id } })
        await tx.supportTicket.update({ where: { id: dispute.ticketId }, data: { status: "RESOLVED" } })
        await tx.ticketMessage.create({ data: { ticketId: dispute.ticketId, authorId: actor.id, text: reason, isStaff: true } })
        data = { status: command.action === "RESUME" ? dispute.previousStatus : "CANCELLED" }; recipients = [job.customerId, job.contract!.developerId]; text = "Поддержка рассмотрела спор"; break
      }
    }
    await tx.job.update({ where: { id: jobId }, data: { ...data, revision: { increment: 1 } } })
    await tx.jobStatusLog.create({ data: { jobId, actorId: actor.id, action: command.action, fromStatus: job.status, toStatus: typeof data.status === "string" ? data.status : job.status, reason } })
    return done(await notice(tx, job, recipients, text))
  })
}
function ownerOrMember(job: LockedJob, actor: JobActor) { if (job.contract) member(job, actor); else owner(job, actor) }
