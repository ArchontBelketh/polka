import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { limits } from "@/lib/ratelimit"
import { initPayment } from "@/lib/payments"
import { analyzeXray } from "@/lib/xray/analyze"
import { putObject, sanitizeFileName } from "@/lib/s3"
import {
  SERVICE_PRICES, SERVICE_LABELS, KIND_BY_SLUG, needsCode, codeRequired, isUpfrontPaid,
} from "@/lib/services"
import { isAiReviewEnabled, getAiSettings } from "@/lib/ai-settings"
import { notifyServiceOrderRequested } from "@/lib/notify"

export const maxDuration = 60

const MAX_FILE = 2 * 1024 * 1024 // 2 МБ

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }
  const email = session.user.email
  if (!email) {
    return Response.json({ error: "Для заказа услуги нужен email в профиле" }, { status: 422 })
  }
  if (!limits.payment(session.user.id)) {
    return Response.json({ error: "Слишком много попыток. Попробуйте позже." }, { status: 429 })
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

  const kind = KIND_BY_SLUG[g("kind")]
  if (!kind) return Response.json({ error: "Неизвестная услуга" }, { status: 422 })

  // AI-аудит выполняется автоматически — без настроенного провайдера нельзя.
  if (kind === "AI_AUDIT" && !isAiReviewEnabled(await getAiSettings())) {
    return Response.json({ error: "AI-аудит временно недоступен" }, { status: 503 })
  }

  const brief = g("brief")
  const contact = g("contact") || null
  if (kind !== "AI_AUDIT" && brief.length < 10) {
    return Response.json({ error: "Опишите задачу подробнее" }, { status: 422 })
  }

  const file = fd.get("file")
  const hasFile = file && typeof file !== "string" && file.size > 0
  if (codeRequired(kind) && !hasFile) {
    return Response.json({ error: "Прикрепите код (.py или .zip)" }, { status: 422 })
  }
  if (hasFile) {
    if (file.size > MAX_FILE) return Response.json({ error: "Файл больше 2 МБ" }, { status: 422 })
    if (!/\.(py|zip)$/i.test(file.name)) {
      return Response.json({ error: "Только .py или .zip" }, { status: 422 })
    }
  }

  // «Спасение проекта» — бесплатная заявка (оплата позже по счёту). Остальное — оплата сразу.
  const upfront = isUpfrontPaid(kind)
  const amount = upfront ? SERVICE_PRICES[kind] : 0
  const order = await db.serviceOrder.create({
    data: {
      kind,
      status: upfront ? "AWAITING_PAYMENT" : "NEW",
      amount,
      userId: session.user.id,
      email,
      brief: brief || "",
      contact,
    },
  })

  // X-Ray по прикреплённому коду (best-effort). Для AI-аудита факты пойдут на вход нейросети.
  if (hasFile && needsCode(kind)) {
    try {
      const buf = Buffer.from(await file.arrayBuffer())
      const key = `services/${order.id}/code/${sanitizeFileName(file.name)}`
      await putObject(key, buf, file.type || "application/octet-stream")
      const report = await analyzeXray({ fileBuffer: buf, fileName: file.name })
      await db.serviceOrder.update({
        where: { id: order.id },
        data: { codeS3Key: key, codeFileName: file.name, xrayReport: report as object },
      })
    } catch (err) {
      console.error("[services] X-Ray/upload error:", err)
    }
  }

  // Бесплатная заявка: без платежа — уведомляем владельца и отдаём заказ.
  if (!upfront) {
    void notifyServiceOrderRequested({ orderId: order.id, kind, email })
    return Response.json({ orderId: order.id })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  let payment
  try {
    payment = await initPayment({
      type: "service_order",
      payload: { serviceOrderId: order.id },
      amountKopecks: amount,
      description: `ПОЛКА: ${SERVICE_LABELS[kind]}`,
      returnUrl: `${appUrl}/services/${order.id}`,
      userId: session.user.id,
    })
  } catch (err) {
    await db.serviceOrder.delete({ where: { id: order.id } }).catch(() => {})
    console.error("[services] createPayment failed:", err)
    return Response.json({ error: "Платёжная система недоступна" }, { status: 503 })
  }

  await db.serviceOrder.update({ where: { id: order.id }, data: { paymentId: payment.paymentId } })
  return Response.json({ confirmationUrl: payment.confirmationUrl, orderId: order.id })
}
