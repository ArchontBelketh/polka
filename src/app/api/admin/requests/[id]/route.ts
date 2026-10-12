import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { REQUEST_STATUSES } from "@/lib/request-status"

type RouteParams = { params: Promise<{ id: string }> }

const schema = z.object({
  status: z.string().optional(),
  notes: z.string().max(5000).optional(),
  spec: z.string().max(10000).optional(),
  kworkUrl: z.string().max(500).optional(),
  comment: z.string().max(500).optional(),
})

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }
  const role = (session.user as { role?: string }).role ?? ""
  if (!["ADMIN", "MODERATOR"].includes(role)) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }

  const { id } = await params
  const existing = await db.request.findUnique({ where: { id }, select: { status: true } })
  if (!existing) return Response.json({ error: "Заявка не найдена" }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Некорректные данные" }, { status: 422 })
  const d = parsed.data

  if (d.status && !REQUEST_STATUSES.includes(d.status)) {
    return Response.json({ error: "Неизвестный статус" }, { status: 422 })
  }

  const data: Record<string, unknown> = {}
  if (d.notes !== undefined) data.notes = d.notes || null
  if (d.spec !== undefined) data.spec = d.spec || null
  if (d.kworkUrl !== undefined) data.kworkUrl = d.kworkUrl || null
  if (d.status && d.status !== existing.status) data.status = d.status

  await db.request.update({ where: { id }, data })

  if (d.status && d.status !== existing.status) {
    await db.requestStatusLog.create({
      data: { requestId: id, status: d.status, comment: d.comment || null },
    })
  }

  return Response.json({ ok: true })
}
