import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) return null
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  return user?.role === "ADMIN" ? session : null
}

const field = z.string().trim().max(300).optional()
const schema = z.object({
  name: field,
  inn: field,
  ogrn: field,
  bankAccount: field,
  address: field,
  email: field,
  phone: field,
  revisionDate: field,
})

export async function GET() {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 })
  const row = await db.operatorSettings.findUnique({ where: { id: "singleton" } })
  return Response.json(row ?? {})
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }
  // Пустые строки → null
  const data = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v && v.length ? v : null]),
  )

  await db.operatorSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  })
  return Response.json({ ok: true })
}
