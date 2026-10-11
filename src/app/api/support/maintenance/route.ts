import { NextRequest } from "next/server"
import { z } from "zod"
import { limits } from "@/lib/ratelimit"
import { sendSupportRequest } from "@/lib/notify"

// Публичная форма обращения со страницы техработ. Без БД (работает во время
// миграции) — только отправка письма. Доступ к роуту во время обслуживания
// разрешён в middleware (proxy.ts).
const schema = z.object({
  email: z.string().email().max(200),
  subject: z.string().min(2).max(200),
  message: z.string().min(5).max(5000),
  name: z.string().max(120).optional(),
  company: z.string().optional(), // honeypot: у людей пустое
})

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  if (!limits.support(ip)) {
    return Response.json({ error: "Слишком много обращений. Попробуйте позже." }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Проверьте поля формы" }, { status: 422 })
  }
  const { email, subject, message, name, company } = parsed.data

  // Honeypot заполнен — это бот: тихо подтверждаем, ничего не отправляем.
  if (company && company.trim()) {
    return Response.json({ ok: true })
  }

  const meta = `IP: ${ip}${name ? ` · Имя: ${name}` : ""} · Отправлено со страницы техработ`
  const ok = await sendSupportRequest({ fromEmail: email, subject, message, meta })
  if (!ok) {
    return Response.json(
      { error: "Не удалось отправить. Напишите, пожалуйста, на почту поддержки." },
      { status: 502 },
    )
  }
  return Response.json({ ok: true })
}
