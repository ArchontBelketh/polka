import { z } from "zod"
import { containsContactInfo } from "@/lib/contact-filter"
import { SPECIALIZATIONS } from "@/lib/developer-profile"

export { SPECIALIZATIONS }
export const JOB_STATUS_LABELS = { OPEN: "Открыт", EXECUTOR_SELECTED: "Исполнитель выбран", IN_PROGRESS: "В работе", ACCEPTANCE: "На приёмке", COMPLETED: "Завершён", CANCELLED: "Отменён", DISPUTED: "Спор" } as const
export const PUBLICATION_LABELS = { DRAFT: "Черновик", PENDING: "На модерации", APPROVED: "Опубликован", REJECTED: "Нужны изменения", SUSPENDED: "Скрыт модератором" } as const
export const publicText = (min: number, max: number) => z.string().trim().min(min, `Не менее ${min} символов`).max(max, `Не более ${max} символов`).refine(text => !containsContactInfo(text), "Уберите контакты из публичного текста")
const amount = z.number().int().positive().max(2_147_483_647)
export const jobFields = z.object({
  title: publicText(8, 140), description: publicText(50, 15000), outcome: publicText(20, 4000),
  specialization: z.enum(["ONE_C", "BOTS", "INTEGRATIONS", "SCRIPTS", "WEB"]),
  budgetMin: amount, budgetMax: amount, deadline: z.iso.datetime().transform(value => new Date(value)),
}).strict().refine(value => value.budgetMin <= value.budgetMax, "Бюджет «от» не должен превышать «до»")
export const createJobSchema = z.object({ id: z.string().uuid(), fields: jobFields }).strict()
export const proposalSchema = z.object({ amount, durationDays: z.number().int().min(1).max(365), approach: publicText(30, 4000), revision: z.number().int().nonnegative() }).strict()
export const commandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("EDIT"), revision: z.number().int().nonnegative(), fields: jobFields }).strict(),
  z.object({ action: z.literal("SUBMIT"), revision: z.number().int().nonnegative() }).strict(),
  z.object({ action: z.enum(["APPROVE", "REJECT", "SUSPEND", "RESTORE"]), revision: z.number().int().nonnegative(), reason: z.string().trim().min(10).max(2000) }).strict(),
  z.object({ action: z.literal("SELECT"), proposalId: z.string().min(1).max(200), proposalRevision: z.number().int().positive() }).strict(),
  z.object({ action: z.literal("WITHDRAW"), revision: z.number().int().positive() }).strict(),
  z.object({ action: z.enum(["START", "WITHDRAW_CANCEL", "CONFIRM_CANCEL", "DECLINE_CANCEL"]) }).strict(),
  z.object({ action: z.enum(["CANCEL", "DISPUTE", "RESUME", "RESOLVE_CANCEL"]), reason: z.string().trim().min(10).max(2000) }).strict(),
  z.object({ action: z.literal("DELIVER"), id: z.string().uuid(), text: z.string().trim().min(30).max(8000), attachmentIds: z.array(z.string().uuid()).max(10) }).strict(),
  z.object({ action: z.literal("ACCEPT"), deliveryId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("REVISION"), deliveryId: z.string().uuid(), reason: z.string().trim().min(10).max(2000) }).strict(),
  z.object({ action: z.literal("MESSAGE"), id: z.string().uuid(), text: z.string().trim().min(1).max(4000) }).strict(),
  z.object({ action: z.literal("REVIEW"), rating: z.number().int().min(1).max(5), text: publicText(20, 2000) }).strict(),
])
export type JobFields = z.infer<typeof jobFields>
export type JobCommand = z.infer<typeof commandSchema>
export type JobActor = { id: string; role: string }
export const WORKSPACE_EVENTS = ["SELECT", "START", "DELIVER", "ACCEPT", "REVISION", "CANCEL", "WITHDRAW_CANCEL", "CONFIRM_CANCEL", "DECLINE_CANCEL", "DISPUTE", "RESUME", "RESOLVE_CANCEL", "SUSPEND", "RESTORE"]
export const ACTIVE_JOB_STATUSES = ["EXECUTOR_SELECTED", "IN_PROGRESS", "ACCEPTANCE"]
export const MAX_JOB_FILE_BYTES = 10 * 1024 * 1024
export class JobError extends Error { constructor(message: string, readonly status = 409) { super(message) } }

export function validateJobDeadline(deadline: Date) {
  const remaining = deadline.getTime() - Date.now()
  if (remaining < 60 * 60 * 1000 || remaining > 366 * 86400000) throw new JobError("Укажите срок от часа до года в будущем", 422)
}

export function canReadWorkspace(job: { customerId: string; contract?: { developerId: string } | null }, actor: JobActor) {
  return actor.id === job.customerId || actor.id === job.contract?.developerId || ["ADMIN", "MODERATOR"].includes(actor.role)
}
