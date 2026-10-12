import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

type RouteParams = { params: Promise<{ id: string }> }

const schema = z.object({ responded: z.boolean() })

// Отметить, что исполнитель ответил на заявку (ТЗ 9.3).
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ""
  if (!["ADMIN", "MODERATOR"].includes(role)) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Некорректные данные" }, { status: 422 })

  await db.requestAssignment.update({
    where: { id },
    data: { responded: parsed.data.responded, respondedAt: parsed.data.responded ? new Date() : null },
  })

  return Response.json({ ok: true })
}
