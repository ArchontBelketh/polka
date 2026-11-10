import { createHash, randomUUID } from "node:crypto"
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { db } from "@/lib/db"
import { sanitizeFileName } from "@/lib/s3"
import { lockJob } from "./service"
import { workspaceAccess } from "./read"
import { canReadWorkspace, JobError, MAX_JOB_FILE_BYTES, type JobActor } from "./policy"
import { isStaff } from "@/lib/permissions"

export const jobStorageConfigured = () => !!process.env.YANDEX_S3_PRIVATE_BUCKET && !!process.env.YANDEX_S3_ACCESS_KEY && !!process.env.YANDEX_S3_SECRET_KEY
function storage() {
  if (!jobStorageConfigured()) throw new JobError("Обмен файлами сейчас недоступен", 503)
  return { Bucket: process.env.YANDEX_S3_PRIVATE_BUCKET!, client: new S3Client({ region: process.env.YANDEX_S3_REGION ?? "ru-central1", endpoint: process.env.YANDEX_S3_ENDPOINT ?? "https://storage.yandexcloud.net", forcePathStyle: true, credentials: { accessKeyId: process.env.YANDEX_S3_ACCESS_KEY!, secretAccessKey: process.env.YANDEX_S3_SECRET_KEY! } }) }
}
export async function readBoundedBody(request: Request) {
  const declared = request.headers.get("content-length")
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_JOB_FILE_BYTES)) throw new JobError("Файл должен быть не больше 10 МБ", 413)
  if (!request.body) throw new JobError("Выберите файл", 422)
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break
      size += value.byteLength
      if (size > MAX_JOB_FILE_BYTES) { await reader.cancel(); throw new JobError("Файл должен быть не больше 10 МБ", 413) }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  if (!size) throw new JobError("Файл пуст", 422)
  return Buffer.concat(chunks)
}
const fileView = (file: { id: string; fileName: string; fileSize: number; authorId: string }) => ({ id: file.id, fileName: file.fileName, fileSize: file.fileSize, authorId: file.authorId })
export async function uploadJobAttachment(actor: JobActor, jobId: string, id: string, rawName: string, request: Request) {
  const job = await workspaceAccess(jobId, actor)
  if (!["IN_PROGRESS", "ACCEPTANCE"].includes(job.status) || job.publicationStatus !== "APPROVED" || ![job.customerId, job.contract!.developerId].includes(actor.id)) throw new JobError("Сейчас нельзя добавлять файлы", 403)
  const name = sanitizeFileName(rawName)
  if (!name || name.length > 180 || /^[.\s]+$/.test(name)) throw new JobError("Укажите корректное имя файла", 422)
  const { client, Bucket } = storage()
  const buffer = await readBoundedBody(request), sha256 = createHash("sha256").update(buffer).digest("hex")
  const existing = await db.jobAttachment.findUnique({ where: { id } })
  const same = (file: { jobId: string; authorId: string; sha256: string; fileName: string }) => file.jobId === jobId && file.authorId === actor.id && file.sha256 === sha256 && file.fileName === name
  if (existing) { if (!same(existing)) throw new JobError("Попытка загрузки уже использована"); return fileView(existing) }
  const s3Key = `jobs/${jobId}/attachments/${id}/${sha256}/${randomUUID()}/${name}`
  await client.send(new PutObjectCommand({ Bucket, Key: s3Key, Body: buffer, ContentType: "application/octet-stream" }))
  // An uncertain commit keeps the object. Never delete a possibly referenced file.
  const result = await db.$transaction(async (tx) => {
    const locked = await lockJob(tx, jobId, actor)
    if (!canReadWorkspace(locked.job, locked.actor) || ![locked.job.customerId, locked.job.contract?.developerId].includes(actor.id) || !["IN_PROGRESS", "ACCEPTANCE"].includes(locked.job.status) || locked.job.publicationStatus !== "APPROVED") return { unused: true as const }
    const committed = await tx.jobAttachment.findUnique({ where: { id } })
    if (committed) return same(committed) ? { file: committed } : { unused: true as const }
    if (await tx.jobAttachment.count({ where: { jobId } }) >= 50) return { unused: true as const }
    return { file: await tx.jobAttachment.create({ data: { id, jobId, authorId: actor.id, fileName: name, fileSize: buffer.length, s3Key, sha256 } }) }
  })
  if ("unused" in result) { await client.send(new DeleteObjectCommand({ Bucket, Key: s3Key })).catch(() => {}); throw new JobError("Состояние заказа изменилось или достигнут лимит 50 файлов") }
  if (result.file.s3Key !== s3Key) await client.send(new DeleteObjectCommand({ Bucket, Key: s3Key })).catch(() => {})
  return fileView(result.file)
}
export async function downloadJobAttachment(actor: JobActor, jobId: string, id: string) {
  const job = await workspaceAccess(jobId, actor)
  if (job.publicationStatus === "SUSPENDED" && !isStaff(actor.role)) throw new JobError("Выдача файлов приостановлена модератором", 403)
  const file = await db.jobAttachment.findUnique({ where: { id } })
  if (!file || file.jobId !== jobId) throw new JobError("Файл не найден", 404)
  const { client, Bucket } = storage()
  return getSignedUrl(client, new GetObjectCommand({ Bucket, Key: file.s3Key, ResponseContentType: "application/octet-stream", ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}` }), { expiresIn: 120 })
}
