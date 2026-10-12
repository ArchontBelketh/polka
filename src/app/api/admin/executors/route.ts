import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const schema = z.object({
  name: z.string().trim().min(2, "Укажите имя").max(200),
  contact: z.string().trim().min(2).max(200),
  stack: z.string().trim().max(300).optional(),
  inn: z.string().trim().max(20).optional(),
  taxStatus: z.string().trim().max(50).optional(),
  xrayReportUrl: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(5000).optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ""
  if (!["ADMIN", "MODERATOR"].includes(role)) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Проверьте поля" }, { status: 422 })
  const d = parsed.data

  const executor = await db.executor.create({
    data: {
      name: d.name,
      contact: d.contact,
      stack: d.stack || null,
      inn: d.inn || null,
      taxStatus: d.taxStatus || null,
      xrayReportUrl: d.xrayReportUrl || null,
      notes: d.notes || null,
    },
  })

  return Response.json({ ok: true, id: executor.id }, { status: 201 })
}
