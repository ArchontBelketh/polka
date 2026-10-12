import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { COMPLAINT_STATUSES } from "@/lib/complaint-status"

type RouteParams = { params: Promise<{ id: string }> }

const schema = z.object({
  status: z.string().optional(),
  decision: z.string().max(5000).optional(),
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
  const complaint = await db.rightsComplaint.findUnique({
    where: { id },
    select: { productId: true },
  })
  if (!complaint) return Response.json({ error: "Жалоба не найдена" }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Некорректные данные" }, { status: 422 })
  const d = parsed.data
  if (d.status && !COMPLAINT_STATUSES.includes(d.status)) {
    return Response.json({ error: "Неизвестный статус" }, { status: 422 })
  }

  const data: Record<string, unknown> = {}
  if (d.decision !== undefined) data.decision = d.decision || null
  if (d.status) data.status = d.status
  await db.rightsComplaint.update({ where: { id }, data })

  // Эффект на товар: скрыть при рассмотрении/удалении, восстановить при отклонении.
  if (complaint.productId && d.status) {
    if (d.status === "REVIEWING" || d.status === "REMOVED") {
      await db.product.update({ where: { id: complaint.productId }, data: { status: "SUSPENDED" } })
      await db.moderationLog.create({
        data: { productId: complaint.productId, moderatorId: session.user.id, action: "SUSPENDED", comment: "Жалоба правообладателя" },
      })
    } else if (d.status === "RESTORED") {
      await db.product.update({ where: { id: complaint.productId }, data: { status: "APPROVED" } })
      await db.moderationLog.create({
        data: { productId: complaint.productId, moderatorId: session.user.id, action: "RESTORED", comment: "Жалоба отклонена" },
      })
    }
  }

  return Response.json({ ok: true })
}
