import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { checkSelfEmployedStatus } from "@/lib/fns"

type RouteParams = { params: Promise<{ id: string }> }

const schema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  contact: z.string().trim().min(2).max(200).optional(),
  stack: z.string().trim().max(300).optional(),
  active: z.boolean().optional(),
  inn: z.string().trim().max(20).optional(),
  taxStatus: z.string().trim().max(50).optional(),
  xrayReportUrl: z.string().trim().max(500).optional(),
  freeRequestsLeft: z.number().int().min(0).max(10000).optional(),
  requestsSent: z.number().int().min(0).max(100000).optional(),
  ordersTaken: z.number().int().min(0).max(100000).optional(),
  relayCount: z.number().int().min(0).max(100000).optional(),
  notes: z.string().trim().max(5000).optional(),
  verifyFns: z.boolean().optional(),
})

async function requireStaff() {
  const session = await auth()
  if (!session?.user?.id) return { error: "Необходима авторизация", status: 401 as const }
  const role = (session.user as { role?: string }).role ?? ""
  if (!["ADMIN", "MODERATOR"].includes(role)) return { error: "Нет доступа", status: 403 as const }
  return { ok: true as const }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const gate = await requireStaff()
  if ("error" in gate) return Response.json({ error: gate.error }, { status: gate.status })

  const { id } = await params
  const existing = await db.executor.findUnique({ where: { id }, select: { inn: true } })
  if (!existing) return Response.json({ error: "Исполнитель не найден" }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Некорректные данные" }, { status: 422 })
  const d = parsed.data

  // Проверка статуса самозанятого через ФНС.
  if (d.verifyFns) {
    const inn = (d.inn || existing.inn || "").trim()
    if (!/^\d{12}$/.test(inn)) {
      return Response.json({ error: "Для проверки ФНС нужен ИНН самозанятого (12 цифр)" }, { status: 422 })
    }
    const res = await checkSelfEmployedStatus(inn)
    if (!res.ok) return Response.json({ error: res.message }, { status: 502 })
    await db.executor.update({
      where: { id },
      data: {
        inn,
        taxVerified: !!res.isSelfEmployed,
        taxCheckedAt: new Date(),
        taxStatus: res.isSelfEmployed ? "Самозанятый" : undefined,
      },
    })
    return Response.json({ ok: true, isSelfEmployed: res.isSelfEmployed, message: res.message })
  }

  const data: Record<string, unknown> = {}
  if (d.name !== undefined) data.name = d.name
  if (d.contact !== undefined) data.contact = d.contact
  if (d.stack !== undefined) data.stack = d.stack || null
  if (d.active !== undefined) data.active = d.active
  if (d.inn !== undefined) data.inn = d.inn || null
  if (d.taxStatus !== undefined) data.taxStatus = d.taxStatus || null
  if (d.xrayReportUrl !== undefined) data.xrayReportUrl = d.xrayReportUrl || null
  if (d.freeRequestsLeft !== undefined) data.freeRequestsLeft = d.freeRequestsLeft
  if (d.requestsSent !== undefined) data.requestsSent = d.requestsSent
  if (d.ordersTaken !== undefined) data.ordersTaken = d.ordersTaken
  if (d.relayCount !== undefined) data.relayCount = d.relayCount
  if (d.notes !== undefined) data.notes = d.notes || null

  await db.executor.update({ where: { id }, data })
  return Response.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const gate = await requireStaff()
  if ("error" in gate) return Response.json({ error: gate.error }, { status: gate.status })
  const { id } = await params
  await db.executor.delete({ where: { id } }).catch(() => {})
  return Response.json({ ok: true })
}
