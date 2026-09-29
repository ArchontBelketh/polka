import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { fiscalizePayout } from "@/lib/payouts"

const schema = z.object({
  status: z.enum(["PROCESSING", "PAID", "REJECTED"]),
})

type RouteParams = { params: Promise<{ id: string }> }

// Allowed transitions from the current status
const ALLOWED: Record<string, string[]> = {
  PENDING: ["PROCESSING", "PAID", "REJECTED"],
  PROCESSING: ["PAID", "REJECTED"],
  PAID: [],
  REJECTED: [],
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }
  const role = (session.user as { role?: string }).role
  if (role !== "ADMIN") {
    return Response.json({ error: "Выплаты подтверждает только администратор" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Некорректный статус" }, { status: 422 })
  }
  const next = parsed.data.status

  const { id } = await params
  const payout = await db.payout.findUnique({ where: { id } })
  if (!payout) {
    return Response.json({ error: "Запрос на выплату не найден" }, { status: 404 })
  }
  if (!ALLOWED[payout.status]?.includes(next)) {
    return Response.json({ error: `Недопустимый переход ${payout.status} → ${next}` }, { status: 409 })
  }

  if (next === "REJECTED") {
    // Средства зарезервированы при создании — возвращаем на баланс и отвязываем
    // продажи от выплаты (снова станут доступны к выводу).
    await db.$transaction([
      db.purchase.updateMany({ where: { payoutId: id }, data: { payoutId: null } }),
      db.user.update({ where: { id: payout.developerId }, data: { balance: { increment: payout.amount } } }),
      db.payout.update({ where: { id }, data: { status: "REJECTED" } }),
    ])
    return Response.json({ ok: true, status: next })
  }

  if (next === "PAID") {
    // Бьём расходный чек в кассе. Не блокируем выплату при сбое чека — деньги
    // отправляются вручную; при ошибке вернём предупреждение, чек добьём позже.
    const receipt = await fiscalizePayout(id)
    await db.payout.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } })
    return Response.json({ ok: true, status: next, receipt })
  }

  // PROCESSING
  await db.payout.update({ where: { id }, data: { status: "PROCESSING" } })
  return Response.json({ ok: true, status: next })
}
