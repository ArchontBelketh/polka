import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createPayment } from "@/lib/yookassa"
import { limits } from "@/lib/ratelimit"

const schema = z.object({
  productId: z.string().min(1),
  couponCode: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  if (!limits.payment(session.user.id)) {
    return Response.json({ error: "Слишком много запросов" }, { status: 429 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { productId, couponCode } = parsed.data
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  const product = await db.product.findUnique({ where: { id: productId } })
  if (!product || product.status !== "APPROVED") {
    return Response.json({ error: "Продукт недоступен для покупки" }, { status: 404 })
  }

  if (product.authorId === session.user.id) {
    return Response.json({ error: "Нельзя купить собственный продукт" }, { status: 400 })
  }

  const existing = await db.purchase.findFirst({
    where: {
      buyerId: session.user.id,
      productId,
      status: { in: ["PAID", "DELIVERED"] },
    },
  })
  if (existing) {
    return Response.json({ error: "Вы уже приобрели этот продукт", purchaseId: existing.id }, { status: 409 })
  }

  // Apply coupon if provided
  let finalPrice = product.price
  let appliedCoupon: { id: string; discountPct: number } | null = null
  if (couponCode) {
    const coupon = await db.coupon.findUnique({ where: { code: couponCode.toUpperCase() } })
    const valid =
      coupon &&
      (!coupon.expiresAt || coupon.expiresAt > new Date()) &&
      (coupon.maxUses === null || coupon.usedCount < coupon.maxUses)
    if (valid && coupon) {
      finalPrice = product.price - Math.floor((product.price * coupon.discountPct) / 100)
      appliedCoupon = { id: coupon.id, discountPct: coupon.discountPct }
    }
  }

  // Create purchase record with PENDING status first
  const purchase = await db.purchase.create({
    data: {
      buyerId: session.user.id,
      productId,
      amount: finalPrice,
      status: "PENDING",
    },
  })

  const idempotencyKey = crypto.randomUUID()

  let yooPayment
  try {
    yooPayment = await createPayment({
      amountKopecks: finalPrice,
      description: `Покупка: ${product.title}`,
      returnUrl: `${appUrl}/purchases?paid=${purchase.id}`,
      metadata: { purchaseId: purchase.id },
      idempotencyKey,
    })
  } catch (err) {
    await db.purchase.delete({ where: { id: purchase.id } })
    console.error("YooKassa create payment error:", err)
    return Response.json({ error: "Ошибка платёжной системы" }, { status: 502 })
  }

  await db.$transaction(async (tx) => {
    await tx.purchase.update({
      where: { id: purchase.id },
      data: { paymentId: yooPayment!.id },
    })
    if (appliedCoupon) {
      await tx.coupon.update({
        where: { id: appliedCoupon.id },
        data: { usedCount: { increment: 1 } },
      })
    }
  })

  const confirmationUrl = yooPayment.confirmation?.confirmation_url
  return Response.json({
    purchaseId: purchase.id,
    confirmationUrl,
    ...(appliedCoupon ? { discountPct: appliedCoupon.discountPct, finalPrice } : {}),
  })
}
