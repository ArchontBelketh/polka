import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ensurePlanRecord } from "@/lib/developer-plan"

// Самостоятельный апгрейд покупателя до разработчика.
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!user) {
    return Response.json({ error: "Пользователь не найден" }, { status: 404 })
  }
  if (user.role === "DEVELOPER") {
    return Response.json({ ok: true, already: true })
  }
  if (user.role !== "BUYER") {
    return Response.json({ error: "Недоступно для вашей роли" }, { status: 403 })
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { role: "DEVELOPER" },
  })
  await ensurePlanRecord(session.user.id) // создаём тарифный план (FREE, слоты по умолчанию)

  return Response.json({ ok: true })
}
