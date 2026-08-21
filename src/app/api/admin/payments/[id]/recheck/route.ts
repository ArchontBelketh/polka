import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getPayment } from "@/lib/tbank"
import { fulfillPayment, failPayment } from "@/lib/payments"

type RouteParams = { params: Promise<{ id: string }> }

const FAIL_STATUSES = new Set(["REJECTED", "CANCELED", "DEADLINE_EXPIRED", "AUTH_FAIL"])

// Ручная сверка платежа с Т-Банком (на случай пропущенного вебхука). Спрашиваем
// GetState и применяем результат: подтверждаем услугу или отменяем.
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }
  const admin = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (admin?.role !== "ADMIN") {
    return Response.json({ error: "Только для администратора" }, { status: 403 })
  }

  const { id } = await params
  const intent = await db.paymentIntent.findUnique({ where: { id } })
  if (!intent) return Response.json({ error: "Платёж не найден" }, { status: 404 })
  if (!intent.paymentId) {
    return Response.json({ error: "Нет PaymentId — платёж не был создан в Т-Банке" }, { status: 400 })
  }

  let state
  try {
    state = await getPayment(intent.paymentId)
  } catch (err) {
    console.error("[admin/payments/recheck] GetState failed:", err)
    return Response.json({ error: "Не удалось запросить статус в Т-Банке" }, { status: 502 })
  }

  if (state.status === "CONFIRMED") {
    if (intent.status !== "CONFIRMED") {
      await fulfillPayment(intent, { paymentId: intent.paymentId })
      await db.paymentIntent.update({ where: { id }, data: { status: "CONFIRMED" } })
    }
    return Response.json({ ok: true, status: "CONFIRMED", applied: true })
  }

  if (FAIL_STATUSES.has(state.status)) {
    if (intent.status !== "FAILED") {
      await failPayment(intent)
      await db.paymentIntent.update({ where: { id }, data: { status: "FAILED" } })
    }
    return Response.json({ ok: true, status: state.status, applied: true })
  }

  // NEW / AUTHORIZED / прочее — ещё не финализирован, статус не меняем.
  return Response.json({ ok: true, status: state.status, applied: false })
}
