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

const schema = z.object({
  enabled: z.boolean(),
  publicId: z.string().trim().max(200).optional(),
  apiSecret: z.string().trim().max(500).optional(),
})

export async function GET() {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 })
  const row = await db.kassaSettings.findUnique({ where: { id: "singleton" } })
  // publicId не секрет — отдаём; apiSecret наружу НЕ отдаём.
  return Response.json({
    enabled: row?.enabled ?? false,
    publicId: row?.publicId ?? "",
    hasSecret: !!row?.apiSecret,
  })
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }
  const { enabled, publicId, apiSecret } = parsed.data

  await db.kassaSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", enabled, publicId: publicId || null, apiSecret: apiSecret || null },
    // Пустой apiSecret при обновлении = не менять сохранённый секрет.
    update: { enabled, publicId: publicId || null, ...(apiSecret ? { apiSecret } : {}) },
  })
  return Response.json({ ok: true })
}
