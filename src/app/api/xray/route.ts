import { NextRequest } from "next/server"
import { limits } from "@/lib/ratelimit"
import { verifySmartCaptcha } from "@/lib/smartcaptcha"
import { analyzeXray } from "@/lib/xray/analyze"

// Анализ может идти до 30 секунд.
export const maxDuration = 60

const MAX_CODE = 1_000_000 // символов для вставки
const MAX_FILE = 2 * 1024 * 1024 // 2 МБ для файла/архива

// Публичная проверка X-Ray: без сессии, код не сохраняется и не логируется.
// 10 проверок в сутки с одного IP, далее — SmartCaptcha.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const underLimit = limits.xray(ip)
  const ct = req.headers.get("content-type") ?? ""

  let code: string | undefined
  let fileBuffer: Buffer | undefined
  let fileName: string | undefined
  let captchaToken: string | undefined

  try {
    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData()
      const t = fd.get("captchaToken")
      if (typeof t === "string") captchaToken = t
      const pasted = fd.get("code")
      if (typeof pasted === "string" && pasted.trim()) code = pasted
      const file = fd.get("file")
      if (file && typeof file !== "string") {
        if (file.size > MAX_FILE) {
          return Response.json({ error: "Файл больше 2 МБ — загрузите только код." }, { status: 413 })
        }
        fileBuffer = Buffer.from(await file.arrayBuffer())
        fileName = file.name
      }
    } else {
      const body = (await req.json().catch(() => null)) as
        | { code?: unknown; captchaToken?: unknown }
        | null
      if (body && typeof body.code === "string") code = body.code
      if (body && typeof body.captchaToken === "string") captchaToken = body.captchaToken
    }
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 })
  }

  // Сверх лимита — требуем капчу.
  if (!underLimit) {
    const ok = await verifySmartCaptcha(captchaToken, ip)
    if (!ok) {
      return Response.json(
        {
          error: "Превышен лимит бесплатных проверок на сегодня. Подтвердите, что вы не робот.",
          captchaRequired: true,
        },
        { status: 429 },
      )
    }
  }

  if (!code && !fileBuffer) {
    return Response.json({ error: "Вставьте код или загрузите файл." }, { status: 422 })
  }
  if (code && code.length > MAX_CODE) {
    return Response.json({ error: "Слишком большой код — загрузите архив (.zip)." }, { status: 413 })
  }

  const report = await analyzeXray({ code, fileBuffer, fileName })
  return Response.json({ ok: true, report })
}
