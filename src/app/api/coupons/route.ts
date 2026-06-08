import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const createSchema = z.object({
  code:        z.string().min(2).max(32).toUpperCase(),
  discountPct: z.number().int().min(1).max(100),
  maxUses:     z.number().int().positive().nullable().optional(),
  expiresAt:   z.string().datetime().nullable().optional(),
})

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) return null
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  return user?.role === "ADMIN" ? user : null
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return Response.json({ error: "Нет доступа" }, { status: 403 })

  const coupons = await db.coupon.findMany({
    orderBy: { createdAt: "desc" },
  })
  return Response.json(coupons)
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return Response.json({ error: "Нет доступа" }, { status: 403 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { code, discountPct, maxUses, expiresAt } = parsed.data

  const existing = await db.coupon.findUnique({ where: { code } })
  if (existing) {
    return Response.json({ error: "Купон с таким кодом уже существует" }, { status: 409 })
  }

  const coupon = await db.coupon.create({
    data: {
      code,
      discountPct,
      maxUses:   maxUses ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: "admin",
    },
  })

  return Response.json(coupon, { status: 201 })
}
