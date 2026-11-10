import { getCurrentUser } from "@/lib/current-user"
import { db } from "@/lib/db"
import { rateLimit } from "@/lib/ratelimit"
import { notifyJobEvent } from "@/lib/notify"
import { JobError, type JobActor } from "./policy"

export async function jobApi(request: Request, work: (actor: JobActor) => Promise<Response>, kind = "write") {
  try {
    const actor = await getCurrentUser()
    if (!actor) return Response.json({ error: "Необходима авторизация" }, { status: 401 })
    if (kind !== "read" && !rateLimit(`jobs:${kind}:${actor.id}`, kind === "file" ? 8 : 30, 60000)) return Response.json({ error: "Слишком много действий. Повторите позже." }, { status: 429 })
    return await work(actor)
  } catch (error) { return jobErrorResponse(error) }
}
export async function readJobJson(request: Request) {
  if (Number(request.headers.get("content-length")) > 65536) throw new JobError("Описание запроса превышает 64 КБ", 413)
  if (!request.body) throw new JobError("Запрос пуст", 422)
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0
  try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 65536) { await reader.cancel(); throw new JobError("Описание запроса превышает 64 КБ", 413) }; chunks.push(part.value) } }
  finally { reader.releaseLock() }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) } catch { throw new JobError("Некорректный JSON", 422) }
}
export function jobErrorResponse(error: unknown) {
  return Response.json({ error: error instanceof JobError ? error.message : "Не удалось выполнить действие. Обновите страницу, чтобы проверить результат." }, { status: error instanceof JobError ? error.status : 503, headers: { "Cache-Control": "private, no-store" } })
}
export async function jobResult(result: { jobId: string; notificationIds: string[]; created?: boolean }) {
  // Persistent in-account events are the source of truth; external delivery is best effort.
  if (result.notificationIds.length) void db.jobNotification.findMany({ where: { id: { in: result.notificationIds } }, select: { text: true, jobId: true, user: { select: { email: true, telegramId: true, isBanned: true } } } })
    .then(events => Promise.allSettled(events.filter(event => !event.user.isBanned).map(event => notifyJobEvent({ email: event.user.email, telegramId: event.user.telegramId, jobId: event.jobId, text: event.text }))))
    .catch(() => { console.error("Job notification delivery failed") })
  return Response.json({ jobId: result.jobId }, { status: result.created ? 201 : 200, headers: { "Cache-Control": "private, no-store" } })
}
