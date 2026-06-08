import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) return null
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  return user?.role === "ADMIN" ? user : null
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return Response.json({ error: "Нет доступа" }, { status: 403 })

  const { id } = await params

  const coupon = await db.coupon.findUnique({ where: { id } })
  if (!coupon) return Response.json({ error: "Купон не найден" }, { status: 404 })

  await db.coupon.delete({ where: { id } })
  return new Response(null, { status: 204 })
}

// PATCH: deactivate by setting expiresAt to now
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return Response.json({ error: "Нет доступа" }, { status: 403 })

  const { id } = await params

  const coupon = await db.coupon.findUnique({ where: { id } })
  if (!coupon) return Response.json({ error: "Купон не найден" }, { status: 404 })

  const updated = await db.coupon.update({
    where: { id },
    data: { expiresAt: new Date() },
  })
  return Response.json(updated)
}
