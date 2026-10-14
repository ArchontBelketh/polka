import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { analyzeXray } from "@/lib/xray/analyze"
import { putObject, sanitizeFileName, getPresignedDownloadUrl } from "@/lib/s3"

export const maxDuration = 60

const MAX_FILE = 2 * 1024 * 1024 // 2 МБ

type RouteParams = { params: Promise<{ id: string }> }

// Рентген приёмки (ТЗ 12.3): оператор грузит сданную работу, запускаем X-Ray.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ""
  if (!["ADMIN", "MODERATOR"].includes(role)) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }

  const { id } = await params
  const request = await db.request.findUnique({ where: { id }, select: { id: true } })
  if (!request) return Response.json({ error: "Заявка не найдена" }, { status: 404 })

  let fd: FormData
  try {
    fd = await req.formData()
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 })
  }
  const file = fd.get("file")
  if (!file || typeof file === "string" || file.size === 0) {
    return Response.json({ error: "Прикрепите файл (.py или .zip)" }, { status: 422 })
  }
  if (file.size > MAX_FILE) return Response.json({ error: "Файл больше 2 МБ" }, { status: 422 })
  if (!/\.(py|zip)$/i.test(file.name)) {
    return Response.json({ error: "Только .py или .zip" }, { status: 422 })
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const key = `requests/${id}/delivery/${sanitizeFileName(file.name)}`
    await putObject(key, buf, file.type || "application/octet-stream")
    const report = await analyzeXray({ fileBuffer: buf, fileName: file.name })
    await db.request.update({
      where: { id },
      data: { deliveredCodeS3Key: key, deliveredCodeFileName: file.name, deliveryXrayReport: report as object },
    })
  } catch (err) {
    console.error("[requests/delivery] X-Ray/upload error:", err)
    return Response.json({ error: "Не удалось обработать файл" }, { status: 500 })
  }

  return Response.json({ ok: true })
}

// Скачивание сданной работы — только персонал.
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ""
  if (!["ADMIN", "MODERATOR"].includes(role)) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }
  const { id } = await params
  const request = await db.request.findUnique({
    where: { id },
    select: { deliveredCodeS3Key: true, deliveredCodeFileName: true },
  })
  if (!request?.deliveredCodeS3Key) return Response.json({ error: "Работа не прикреплена" }, { status: 404 })
  const url = await getPresignedDownloadUrl(request.deliveredCodeS3Key, 900, request.deliveredCodeFileName ?? undefined)
  return Response.redirect(url, 302)
}
