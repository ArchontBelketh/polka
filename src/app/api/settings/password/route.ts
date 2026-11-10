import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import bcrypt from "bcryptjs"

const schema = z.object({
  current: z.string().min(1),
  next:    z.string().min(8).max(128),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  })

  if (!user?.passwordHash) {
    return Response.json({ error: "У вашего аккаунта нет пароля" }, { status: 400 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422 })

  const valid = await bcrypt.compare(parsed.data.current, user.passwordHash)
  if (!valid) return Response.json({ error: "Неверный текущий пароль" }, { status: 400 })

  const hash = await bcrypt.hash(parsed.data.next, 12)
  const changed = await db.user.updateMany({
    where: { id: session.user.id, passwordHash: user.passwordHash },
    data: {
      passwordHash: hash,
      sessionVersion: { increment: 1 },
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    },
  })
  if (changed.count === 0) {
    return Response.json({ error: "Пароль уже изменён. Войдите снова." }, { status: 409 })
  }

  return Response.json({ ok: true })
}
