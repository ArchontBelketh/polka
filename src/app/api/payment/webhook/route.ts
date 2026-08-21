import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { getPayment, verifyNotificationToken } from "@/lib/tbank"
import { fulfillPayment, failPayment } from "@/lib/payments"

// Нотификация Т-Банка: подпись проверяется Token'ом (а не белым списком IP).
// Успех платежа — Status = CONFIRMED. За что платёж — определяем по PaymentIntent,
// найденному по OrderId (Т-Банк всегда возвращает OrderId; DATA он НЕ эхонит).
const FAIL_STATUSES = new Set(["REJECTED", "CANCELED", "DEADLINE_EXPIRED", "AUTH_FAIL"])

export async function POST(req: NextRequest) {
  if (!process.env.TBANK_PASSWORD) {
    console.error("Webhook: TBANK_PASSWORD not set")
    return new Response("Service unavailable", { status: 503 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response("Bad Request", { status: 400 })
  }

  console.log(
    `Webhook in: Status=${body.Status} OrderId=${body.OrderId} PaymentId=${body.PaymentId} Success=${body.Success}`,
  )

  if (!verifyNotificationToken(body)) {
    console.warn("Webhook: invalid T-Bank token")
    return new Response("Forbidden", { status: 403 })
  }

  const status = String(body.Status ?? "")
  const orderId = String(body.OrderId ?? "")
  const paymentId = String(body.PaymentId ?? "")
  const success = body.Success === true || body.Success === "true"

  // Что оплачивалось — берём из PaymentIntent по OrderId. Резервно ищем по
  // PaymentId (на случай, если OrderId вдруг не пришёл).
  const intent =
    (orderId ? await db.paymentIntent.findUnique({ where: { orderId } }) : null) ??
    (paymentId ? await db.paymentIntent.findFirst({ where: { paymentId } }) : null)

  if (!intent) {
    // Нет намерения — подтверждаем приём, но выдавать нечего (напр. старый платёж
    // до внедрения PaymentIntent, либо чужой терминал).
    console.warn("Webhook: PaymentIntent не найден для OrderId", orderId, "PaymentId", paymentId)
    return new Response("OK", { status: 200 })
  }

  if (status === "CONFIRMED" && success) {
    if (intent.status === "CONFIRMED") {
      return new Response("OK", { status: 200 }) // идемпотентность (повторная нотификация)
    }
    // Повторная проверка статуса через GetState (авторитетный источник).
    let state
    try {
      state = await getPayment(paymentId)
    } catch (err) {
      console.error("Webhook: failed to verify payment", err)
      return new Response("Error", { status: 502 })
    }
    if (state.status !== "CONFIRMED") {
      return new Response("OK", { status: 200 })
    }

    await fulfillPayment(intent, { paymentId })
    await db.paymentIntent.update({
      where: { id: intent.id },
      data: { status: "CONFIRMED", paymentId },
    })
  } else if (FAIL_STATUSES.has(status)) {
    if (intent.status !== "FAILED") {
      await failPayment(intent)
      await db.paymentIntent.update({
        where: { id: intent.id },
        data: { status: "FAILED", paymentId },
      })
    }
  }

  return new Response("OK", { status: 200 })
}
