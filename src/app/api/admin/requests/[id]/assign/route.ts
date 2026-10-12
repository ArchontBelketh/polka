import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { notifyRequestToExecutor } from "@/lib/notify"

type RouteParams = { params: Promise<{ id: string }> }

const schema = z.object({ executorIds: z.array(z.string()).min(1).max(3) })

// Отправить заявку выбранным исполнителям (не более 3 на заявку, ТЗ 11.4).
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ""
  if (!["ADMIN", "MODERATOR"].includes(role)) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }

  const { id } = await params
  const request = await db.request.findUnique({
    where: { id },
    include: { assignments: { select: { executorId: true } } },
  })
  if (!request) return Response.json({ error: "Заявка не найдена" }, { status: 404 })
  if (!request.consentContacts) {
    return Response.json({ error: "Нет согласия заказчика на передачу контактов" }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Выберите 1–3 исполнителей" }, { status: 422 })

  const already = new Set(request.assignments.map((a) => a.executorId))
  const toAdd = parsed.data.executorIds.filter((eid) => !already.has(eid))
  if (already.size + toAdd.length > 3) {
    return Response.json({ error: "Заявку можно отправить не более чем 3 исполнителям" }, { status: 400 })
  }
  if (toAdd.length === 0) {
    return Response.json({ error: "Эти исполнители уже получили заявку" }, { status: 409 })
  }

  const executors = await db.executor.findMany({ where: { id: { in: toAdd } } })

  for (const e of executors) {
    await db.$transaction([
      db.requestAssignment.create({ data: { requestId: id, executorId: e.id } }),
      db.executor.update({
        where: { id: e.id },
        data: {
          requestsSent: { increment: 1 },
          ...(e.freeRequestsLeft > 0 ? { freeRequestsLeft: { decrement: 1 } } : {}),
        },
      }),
    ])
    void notifyRequestToExecutor({
      executorContact: e.contact,
      task: request.task,
      platform: request.platform,
      budget: request.budget,
      deadline: request.deadline,
      customerContact: request.contact,
    })
  }

  return Response.json({ ok: true, sent: executors.length })
}
