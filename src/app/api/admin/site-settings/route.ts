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
  relaySlaEnabled: z.boolean(),
  relaySlaDays: z.number().int().min(1).max(60),
})

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return Response.json({ error: "Некорректные данные" }, { status: 422 })
  const { relaySlaEnabled, relaySlaDays } = parsed.data

  await db.siteSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", relaySlaEnabled, relaySlaDays },
    update: { relaySlaEnabled, relaySlaDays },
  })
  return Response.json({ ok: true })
}
