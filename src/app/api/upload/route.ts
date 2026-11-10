import { NextRequest } from "next/server"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/current-user"
import { canManageCode } from "@/lib/permissions"
import { getPresignedUploadUrl, productVersionUploadKey, sanitizeFileName, MAX_SCREENSHOT_BYTES } from "@/lib/s3"
import { prepareProductUpload } from "@/lib/product-uploads"
import { isUploadEditable, ProductUploadError } from "@/lib/product-upload-policy"
import { limits } from "@/lib/ratelimit"
import { clientIp } from "@/lib/ip"

const uploadSchema = z.object({
  uploadId: z.string().uuid().optional(), productId: z.string().min(1).max(200),
  type: z.enum(["source", "screenshot", "version"]), fileName: z.string().min(1).max(200),
  fileSize: z.number().int().positive().max(100 * 1024 * 1024), contentType: z.string().max(150),
  screenshotIndex: z.number().int().min(0).max(4).optional(),
}).strict()
const sourceTypes = new Set(["application/zip", "application/x-zip-compressed", "text/x-python", "application/octet-stream", "application/vnd.ms-excel.sheet.macroenabled.12", "application/x-xlsm"])
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"])
const s3Configured = !!process.env.YANDEX_S3_ACCESS_KEY && !!process.env.YANDEX_S3_SECRET_KEY

export async function POST(req: NextRequest) {
  if (!limits.upload(clientIp(req) || "anonymous")) return Response.json({ error: "Слишком много запросов" }, { status: 429 })
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  if (!canManageCode(user.role)) return Response.json({ error: "Недостаточно прав" }, { status: 403 })
  const parsed = uploadSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Проверьте тип, имя и размер файла" }, { status: 422 })
  const input = parsed.data
  const fileName = sanitizeFileName(input.fileName)
  if (!fileName || /^[.\s]+$/.test(fileName)) return Response.json({ error: "Укажите корректное имя файла" }, { status: 422 })
  const product = await db.product.findUnique({ where: { id: input.productId }, select: { id: true, authorId: true, status: true, publishedAt: true } })
  if (!product) return Response.json({ error: "Продукт не найден" }, { status: 404 })
  if (product.authorId !== user.id) return Response.json({ error: "Нет доступа" }, { status: 403 })
  if (input.uploadId && input.type !== "version") {
    const completed = await db.productUpload.findUnique({ where: { id: input.uploadId } })
    if (completed?.status === "COMPLETED" && completed.productId === product.id && completed.type === input.type && completed.slot === (input.type === "source" ? 0 : input.screenshotIndex ?? 0) && completed.fileName === fileName && completed.fileSize === input.fileSize && completed.contentType === input.contentType) return Response.json({ uploadId: completed.id, completed: true })
  }
  if ((input.type === "version" && product.status !== "APPROVED") || (input.type !== "version" && !isUploadEditable(product))) return Response.json({ error: "Файлы опубликованного или проверяемого товара менять нельзя. Используйте новую версию." }, { status: 409 })
  if (input.type === "screenshot" && (!imageTypes.has(input.contentType) || input.fileSize > MAX_SCREENSHOT_BYTES)) return Response.json({ error: "Скриншот должен быть JPEG/PNG/WebP до 5 МБ" }, { status: 422 })
  if (input.type !== "screenshot" && !sourceTypes.has(input.contentType) && ![".zip", ".py", ".js", ".ts", ".epf", ".erf", ".xlsm", ".xls"].some((ext) => fileName.toLowerCase().endsWith(ext))) return Response.json({ error: "Недопустимый тип файла" }, { status: 422 })
  if (!s3Configured) return Response.json({ error: "Хранилище файлов временно недоступно. Файл не зарегистрирован." }, { status: 503 })
  if (input.type === "version") {
    const key = productVersionUploadKey(input.productId, fileName)
    return Response.json({ key, url: await getPresignedUploadUrl(key, input.contentType) })
  }
  try {
    const upload = await prepareProductUpload(user.id, { id: input.uploadId ?? randomUUID(), productId: input.productId, type: input.type, slot: input.type === "source" ? 0 : input.screenshotIndex ?? 0, fileName, fileSize: input.fileSize, contentType: input.contentType })
    if (upload.status === "COMPLETED") return Response.json({ uploadId: upload.id, completed: true })
    return Response.json({ uploadId: upload.id, key: upload.stagingKey, url: await getPresignedUploadUrl(upload.stagingKey, input.contentType) })
  } catch (error) {
    if (error instanceof ProductUploadError) return Response.json({ error: error.message }, { status: error.status })
    return Response.json({ error: "Не удалось подготовить загрузку. Повторите попытку." }, { status: 503 })
  }
}
