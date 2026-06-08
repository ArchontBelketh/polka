import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { limits } from "@/lib/ratelimit"

const schema = z.object({
  code: z.string().min(1),
  priceKopecks: z.number().int().positive(),
})

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  if (!limits.coupon(ip)) {
    return Response.json({ error: "Слишком много запросов" }, { status: 429 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { code, priceKopecks } = parsed.data

  const coupon = await db.coupon.findUnique({ where: { code: code.toUpperCase() } })

  if (!coupon) {
    return Response.json({ error: "Купон не найден" }, { status: 404 })
  }

  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    return Response.json({ error: "Срок действия купона истёк" }, { status: 400 })
  }

  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return Response.json({ error: "Купон исчерпан" }, { status: 400 })
  }

  const discountKopecks = Math.floor((priceKopecks * coupon.discountPct) / 100)
  const finalPrice = priceKopecks - discountKopecks

  return Response.json({
    valid: true,
    discountPct: coupon.discountPct,
    discountKopecks,
    finalPrice,
  })
}
