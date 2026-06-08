import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) return null
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!user || user.role !== "ADMIN") return null
  return session
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ban"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("unban") }),
])

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin()
  if (!session) return Response.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 })

  const target = await db.user.findUnique({ where: { id }, select: { id: true, role: true } })
  if (!target) return Response.json({ error: "Not found" }, { status: 404 })
  if (target.role === "ADMIN") return Response.json({ error: "Нельзя заблокировать администратора" }, { status: 403 })

  if (parsed.data.action === "ban") {
    await db.user.update({
      where: { id },
      data: {
        isBanned: true,
        bannedAt: new Date(),
        banReason: parsed.data.reason ?? null,
      },
    })
  } else {
    await db.user.update({
      where: { id },
      data: { isBanned: false, bannedAt: null, banReason: null },
    })
  }

  return Response.json({ ok: true })
}
