import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const schema = z.object({
  name:           z.string().min(1).max(100).optional(),
  telegramHandle: z.string().max(64).optional().nullable(),
  phone:          z.string().max(32).optional().nullable(),
  bio:            z.string().max(1000).optional().nullable(),
})

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422 })

  const data = parsed.data

  await db.user.update({
    where: { id: session.user.id },
    data: {
      ...(data.name           !== undefined ? { name:           data.name           } : {}),
      ...(data.telegramHandle !== undefined ? { telegramHandle: data.telegramHandle } : {}),
      ...(data.phone          !== undefined ? { phone:          data.phone          } : {}),
      ...(data.bio            !== undefined ? { bio:            data.bio            } : {}),
    },
  })

  return Response.json({ ok: true })
}
