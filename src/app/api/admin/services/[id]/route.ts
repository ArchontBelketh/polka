import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { deleteObject } from "@/lib/s3"
import { notifyServiceReportReady } from "@/lib/notify"
import { SERVICE_STATUSES } from "@/lib/services"

type RouteParams = { params: Promise<{ id: string }> }

const schema = z.object({
  status: z.enum(SERVICE_STATUSES as [string, ...string[]]).optional(),
  report: z.string().max(20000).optional(),
  expertId: z.string().nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ""
  if (!["ADMIN", "MODERATOR"].includes(role)) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }

  const { id } = await params
  const existing = await db.serviceOrder.findUnique({
    where: { id },
    select: { status: true, codeS3Key: true, codeDeletedAt: true },
  })
  if (!existing) return Response.json({ error: "Заказ не найден" }, { status: 404 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Некорректные данные" }, { status: 422 })
  const d = parsed.data

  if (d.expertId) {
    const exists = await db.executor.findUnique({ where: { id: d.expertId }, select: { id: true } })
    if (!exists) return Response.json({ error: "Исполнитель не найден" }, { status: 422 })
  }

  const data: Record<string, unknown> = {}
  if (d.report !== undefined) data.report = d.report || null
  if (d.expertId !== undefined) data.expertId = d.expertId || null

  const now = new Date()
  const statusChanged = d.status && d.status !== existing.status
  if (statusChanged) {
    data.status = d.status
    if (d.status === "REPORT_READY") data.reportReadyAt = now
    if (d.status === "CLOSED") data.closedAt = now
  }

  // Код клиента удаляется после сдачи/закрытия (ТЗ 11.4).
  const shouldPurgeCode =
    statusChanged && (d.status === "CLOSED") && existing.codeS3Key && !existing.codeDeletedAt
  if (shouldPurgeCode) {
    await deleteObject(existing.codeS3Key!).catch(() => {})
    data.codeDeletedAt = now
  }

  await db.serviceOrder.update({ where: { id }, data })

  if (statusChanged && d.status === "REPORT_READY") {
    const order = await db.serviceOrder.findUnique({
      where: { id },
      select: { id: true, kind: true, email: true },
    })
    if (order) void notifyServiceReportReady({ orderId: order.id, kind: order.kind, email: order.email })
  }

  return Response.json({ ok: true })
}
