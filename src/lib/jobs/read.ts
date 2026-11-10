import { db } from "@/lib/db"
import type { JobActor } from "./policy"
import { canReadWorkspace, JobError, WORKSPACE_EVENTS } from "./policy"
import { isStaff } from "@/lib/permissions"
import { publicJobSelect, publicJobsWhere } from "./query"

export async function readJob(jobId: string, actor: JobActor | null) {
  const access = await db.job.findUnique({ where: { id: jobId }, select: { customerId: true, publicationStatus: true, customer: { select: { isBanned: true } } } })
  if (!access) throw new JobError("Заказ не найден", 404)
  const manage = !!actor && (access.customerId === actor.id || isStaff(actor.role))
  if (!manage && (access.publicationStatus !== "APPROVED" || access.customer.isBanned)) throw new JobError("Заказ не найден", 404)
  // Never serialize the full model: cancellation, moderation and submission data are private.
  const job = await db.job.findUnique({ where: { id: jobId }, select: {
    ...publicJobSelect,
    ...(manage ? { publicationStatus: true, moderationReason: true, revision: true, customerId: true } : {}),
  } })
  return { job, canManage: manage }
}

export async function readProposals(jobId: string, actor: JobActor) {
  const job = await db.job.findUnique({ where: { id: jobId }, select: { customerId: true, publicationStatus: true, customer: { select: { isBanned: true } } } })
  if (!job) throw new JobError("Заказ не найден", 404)
  const manager = job.customerId === actor.id || isStaff(actor.role)
  if (!manager && (job.publicationStatus !== "APPROVED" || job.customer.isBanned)) throw new JobError("Заказ не найден", 404)
  const proposals = await db.jobProposal.findMany({ where: { jobId, ...(manager ? {} : { developerId: actor.id }) }, orderBy: { createdAt: "asc" }, take: 200, select: {
    id: true, developerId: true, amount: true, durationDays: true, approach: true, status: true, revision: true,
    developer: { select: { id: true, name: true } },
  } })
  const history = proposals.length ? await db.jobStatusLog.findMany({ where: { jobId, proposalId: { in: proposals.map(proposal => proposal.id) } }, orderBy: { createdAt: "desc" }, take: 200, select: { proposalId: true, action: true, data: true, createdAt: true } }) : []
  return { proposals, history }
}

export async function workspaceAccess(jobId: string, actor: JobActor) {
  const job = await db.job.findUnique({ where: { id: jobId }, include: { contract: true } })
  if (!job?.contract || !canReadWorkspace(job, actor)) throw new JobError("Рабочая область не найдена", 404)
  return { ...job, contract: job.contract }
}

export async function readWorkspace(jobId: string, actor: JobActor, before?: string) {
  const job = await workspaceAccess(jobId, actor)
  const anchor = before ? await db.jobMessage.findUnique({ where: { id: before }, select: { id: true, jobId: true, createdAt: true } }) : null
  if (before && (!anchor || anchor.jobId !== jobId)) throw new JobError("Сообщение не найдено", 404)
  const [messages, attachments, deliveries, reviews, events, dispute] = await Promise.all([
    db.jobMessage.findMany({ where: { jobId, ...(anchor ? { OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } }] } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 101, select: { id: true, senderId: true, text: true, createdAt: true, sender: { select: { id: true, name: true } } } }),
    db.jobAttachment.findMany({ where: { jobId }, orderBy: { createdAt: "asc" }, take: 50, select: { id: true, fileName: true, fileSize: true, authorId: true, createdAt: true } }),
    db.jobDelivery.findMany({ where: { jobId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, developerId: true, text: true, attachmentIds: true, status: true, customerFeedback: true, createdAt: true } }),
    db.jobReview.findMany({ where: { jobId }, select: { id: true, authorId: true, recipientId: true, rating: true, text: true } }),
    db.jobStatusLog.findMany({ where: { jobId, action: { in: WORKSPACE_EVENTS } }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, actorId: true, action: true, fromStatus: true, toStatus: true, reason: true, createdAt: true } }),
    db.jobDispute.findUnique({ where: { jobId }, select: { reason: true, previousStatus: true, resolution: true, resolvedAt: true, ticketId: true } }),
  ])
  return { job: { id: job.id, title: job.title, customerId: job.customerId, status: job.status, publicationStatus: job.publicationStatus, cancellationRequestedBy: job.cancellationRequestedBy, cancellationReason: job.cancellationReason }, contract: job.contract,
    messages: messages.slice(0, 100).reverse(), hasOlderMessages: messages.length > 100, attachments, deliveries, reviews, events, dispute }
}

export async function publicJobReviews(recipientId: string) {
  return db.jobReview.findMany({ where: { recipientId, job: { ...publicJobsWhere, status: "COMPLETED" }, author: { isBanned: false } }, orderBy: { createdAt: "desc" }, take: 20,
    select: { id: true, rating: true, text: true, createdAt: true, author: { select: { id: true, name: true } }, job: { select: { id: true, title: true } } } })
}
