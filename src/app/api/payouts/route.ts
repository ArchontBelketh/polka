import { getCurrentUser } from "@/lib/current-user"
import { db } from "@/lib/db"
import { createPayoutForDeveloper } from "@/lib/payouts"
import { FinancialError } from "@/lib/financial-lock"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const payouts = await db.payout.findMany({
    where: { developerId: user.id },
    orderBy: { requestedAt: "desc" },
    take: 50,
  })

  return Response.json(payouts)
}

// Вывод «всё или ничего»: суммы не выбираем — выводится весь доступный баланс
// (все зачисленные, ещё не выплаченные продажи).
export async function POST() {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  if (!["DEVELOPER", "ADMIN"].includes(user.role)) {
    return Response.json({ error: "Только разработчики могут запрашивать вывод" }, { status: 403 })
  }
  try {
    const result = await createPayoutForDeveloper(user.id)
    if ("error" in result) return Response.json({ error: result.error }, { status: 400 })
    return Response.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof FinancialError) return Response.json({ error: error.message }, { status: error.status })
    return Response.json({ error: "Ответ не получен. Проверьте список выплат перед повторным запросом." }, { status: 503 })
  }
}
