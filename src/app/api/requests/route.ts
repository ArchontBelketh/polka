import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { limits } from "@/lib/ratelimit"
import { notifyNewRequest } from "@/lib/notify"
import { analyzeXray } from "@/lib/xray/analyze"
import { putObject, sanitizeFileName } from "@/lib/s3"

export const maxDuration = 60

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_FILE = 2 * 1024 * 1024 // 2 МБ

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  if (!limits.request(ip)) {
    return Response.json({ error: "Слишком много заявок. Попробуйте позже." }, { status: 429 })
  }

  let fd: FormData
  try {
    fd = await req.formData()
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 })
  }
  const g = (k: string) => {
    const v = fd.get(k)
    return typeof v === "string" ? v.trim() : ""
  }

  const task = g("task")
  const platform = g("platform")
  const contact = g("contact")
  const consentPd = fd.get("consentPd") === "true"
  const consentContacts = fd.get("consentContacts") === "true"

  if (task.length < 10 || !platform || contact.length < 3) {
    return Response.json({ error: "Проверьте поля формы" }, { status: 422 })
  }
  if (!consentPd || !consentContacts) {
    return Response.json({ error: "Нужно отметить оба согласия" }, { status: 422 })
  }

  const session = await auth()
  const request = await db.request.create({
    data: {
      task,
      platform,
      deadline: g("deadline") || null,
      budget: g("budget") || null,
      contact,
      messenger: g("messenger") || null,
      consentPd: true,
      consentContacts: true,
      userId: session?.user?.id ?? null,
    },
  })
  await db.requestStatusLog.create({
    data: { requestId: request.id, status: "NEW", comment: "Заявка создана" },
  })

  // X-Ray по прикреплённому коду (best-effort, не роняет создание заявки).
  const file = fd.get("file")
  if (file && typeof file !== "string" && file.size > 0 && file.size <= MAX_FILE && /\.(py|zip)$/i.test(file.name)) {
    try {
      const buf = Buffer.from(await file.arrayBuffer())
      const key = `requests/${request.id}/code/${sanitizeFileName(file.name)}`
      await putObject(key, buf, file.type || "application/octet-stream")
      const report = await analyzeXray({ fileBuffer: buf, fileName: file.name })
      await db.request.update({
        where: { id: request.id },
        data: { codeS3Key: key, codeFileName: file.name, xrayReport: report as object },
      })
    } catch (err) {
      console.error("[requests] X-Ray/upload error:", err)
    }
  }

  const customerEmail = EMAIL_RE.test(contact) ? contact : session?.user?.email ?? null
  void notifyNewRequest({
    requestId: request.id,
    task,
    platform,
    budget: g("budget") || null,
    deadline: g("deadline") || null,
    contact,
    messenger: g("messenger") || null,
    customerEmail,
  })

  return Response.json({ ok: true, requestId: request.id }, { status: 201 })
}
