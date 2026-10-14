import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { REQUEST_STATUSES } from "@/lib/request-status"
import { notifyRequestRelay, notifyRequestClosed } from "@/lib/notify"

type RouteParams = { params: Promise<{ id: string }> }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const schema = z.object({
  status: z.string().optional(),
  notes: z.string().max(5000).optional(),
  spec: z.string().max(10000).optional(),
  kworkUrl: z.string().max(500).optional(),
  projectPassport: z.string().max(20000).optional(),
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
  const existing = await db.request.findUnique({
    where: { id },
    select: {
      status: true, projectPassport: true, contact: true,
      user: { select: { email: true } },
    },
  })
  if (!existing) return Response.json({ error: "Заявка не найдена" }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Некорректные данные" }, { status: 422 })
  const d = parsed.data

  if (d.status && !REQUEST_STATUSES.includes(d.status)) {
    return Response.json({ error: "Неизвестный статус" }, { status: 422 })
  }

  const statusChanged = !!d.status && d.status !== existing.status

  // Паспорт проекта обязателен для закрытия заявки (ТЗ 12.2).
  const passportAfter = d.projectPassport !== undefined ? d.projectPassport : existing.projectPassport
  if (statusChanged && d.status === "CLOSED" && !passportAfter?.trim()) {
    return Response.json({ error: "Нельзя закрыть заявку без паспорта проекта" }, { status: 422 })
  }

  const data: Record<string, unknown> = {}
  if (d.notes !== undefined) data.notes = d.notes || null
  if (d.spec !== undefined) data.spec = d.spec || null
  if (d.kworkUrl !== undefined) data.kworkUrl = d.kworkUrl || null
  if (d.projectPassport !== undefined) data.projectPassport = d.projectPassport || null
  if (statusChanged) data.status = d.status

  await db.request.update({ where: { id }, data })

  if (statusChanged) {
    await db.requestStatusLog.create({
      data: { requestId: id, status: d.status!, comment: d.comment || null },
    })

    // Уведомления заказчику по ключевым переходам (ТЗ 12.1/12.2/12.4).
    const customerEmail = EMAIL_RE.test(existing.contact) ? existing.contact : existing.user?.email ?? null
    if (customerEmail) {
      if (d.status === "RELAY") {
        void notifyRequestRelay({ requestId: id, email: customerEmail })
      } else if (d.status === "CLOSED") {
        void notifyRequestClosed({ requestId: id, email: customerEmail, passport: passportAfter ?? "" })
      }
    }
  }

  return Response.json({ ok: true })
}
