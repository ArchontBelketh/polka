import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createPayoutForDeveloper } from "@/lib/payouts"

const schema = z.object({ developerId: z.string().min(1) })

// Админ инициирует выплату разработчику (весь доступный баланс).
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }
  const me = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (me?.role !== "ADMIN") {
    return Response.json({ error: "Только для администратора" }, { status: 403 })
  }

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: "Неверные параметры" }, { status: 422 })
  }

  const dev = await db.user.findUnique({ where: { id: parsed.data.developerId }, select: { payoutsFrozen: true } })
  if (!dev) return Response.json({ error: "Разработчик не найден" }, { status: 404 })
  if (dev.payoutsFrozen) {
    return Response.json({ error: "Выплаты по этому аккаунту приостановлены" }, { status: 403 })
  }

  const result = await createPayoutForDeveloper(parsed.data.developerId)
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 })
  }
  return Response.json(result, { status: 201 })
}
