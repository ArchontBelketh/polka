import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { checkSelfEmployedStatus } from "@/lib/fns"
import { rateLimit } from "@/lib/ratelimit"

const schema = z.object({ userId: z.string().min(1) })

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }
  const me = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!me || !["ADMIN", "MODERATOR"].includes(me.role)) {
    return Response.json({ error: "Только для админа/модератора" }, { status: 403 })
  }

  // ФНС ограничивает 2 запроса/мин с IP — не даём кликать чаще.
  if (!rateLimit(`fns:${session.user.id}`, 2, 60_000)) {
    return Response.json({ error: "Слишком часто. Подождите минуту (лимит ФНС)." }, { status: 429 })
  }

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: "Неверные параметры" }, { status: 422 })
  }

  const profile = await db.payoutProfile.findUnique({ where: { userId: parsed.data.userId } })
  if (!profile) {
    return Response.json({ error: "У пользователя нет налогового профиля" }, { status: 404 })
  }
  if (profile.kind !== "SELF_EMPLOYED") {
    return Response.json(
      { error: "Проверка НПД доступна только для самозанятых. Для ИП/ООО — другой контроль." },
      { status: 400 },
    )
  }

  const result = await checkSelfEmployedStatus(profile.inn)
  if (!result.ok) {
    return Response.json({ error: result.message }, { status: 502 })
  }

  await db.payoutProfile.update({
    where: { userId: parsed.data.userId },
    data: { verified: result.isSelfEmployed ?? false },
  })

  return Response.json({ verified: result.isSelfEmployed, message: result.message })
}
