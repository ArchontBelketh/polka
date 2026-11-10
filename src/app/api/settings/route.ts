import { getCurrentUser } from "@/lib/current-user"
import { db } from "@/lib/db"
import { z } from "zod"

const schema = z.object({
  name:           z.string().trim().min(1).max(100).optional().nullable(),
  telegramHandle: z.string().trim().max(64).optional().nullable(),
  phone:          z.string().trim().max(32).optional().nullable(),
  bio:            z.string().trim().max(1000).optional().nullable(),
}).strict()

export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: "Необходима авторизация" }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return Response.json({ error: "Не удалось прочитать данные формы" }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422 })

  const data = parsed.data

  await db.user.update({
    where: { id: user.id },
    data: {
      ...(data.name           !== undefined ? { name:           data.name           } : {}),
      ...(data.telegramHandle !== undefined ? { telegramHandle: data.telegramHandle } : {}),
      ...(data.phone          !== undefined ? { phone:          data.phone          } : {}),
      ...(data.bio            !== undefined ? { bio:            data.bio            } : {}),
    },
  })

  return Response.json({ ok: true })
}
