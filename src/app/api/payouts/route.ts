import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createPayoutForDeveloper } from "@/lib/payouts"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const payouts = await db.payout.findMany({
    where: { developerId: session.user.id },
    orderBy: { requestedAt: "desc" },
    take: 50,
  })

  return Response.json(payouts)
}

// Вывод «всё или ничего»: суммы не выбираем — выводится весь доступный баланс
// (все зачисленные, ещё не выплаченные продажи).
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["DEVELOPER", "ADMIN"].includes(user.role)) {
    return Response.json({ error: "Только разработчики могут запрашивать вывод" }, { status: 403 })
  }
  if (user.payoutsFrozen) {
    return Response.json({ error: "Выплаты по вашему аккаунту приостановлены. Обратитесь в поддержку." }, { status: 403 })
  }

  const result = await createPayoutForDeveloper(session.user.id)
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 })
  }
  return Response.json(result, { status: 201 })
}
