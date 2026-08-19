import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createPayment } from "@/lib/tbank"

const AI_REVIEW_PRICE = 39000 // 390 RUB in kopecks

const postBody = z.object({ productId: z.string().min(1) })

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const parsed = postBody.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: "Неверные параметры" }, { status: 422 })
  }

  const { productId } = parsed.data

  const product = await db.product.findUnique({
    where: { id: productId, status: "APPROVED" },
    select: { id: true, title: true },
  })
  if (!product) {
    return Response.json({ error: "Продукт не найден" }, { status: 404 })
  }

  // Clean up any stale PENDING/FAILED records before creating a new one
  await db.aiReview.deleteMany({
    where: {
      productId,
      requestedBy: session.user.id,
      status: { in: ["PENDING", "FAILED"] },
    },
  })

  const aiReview = await db.aiReview.create({
    data: {
      productId,
      requestedBy: session.user.id,
      amount: AI_REVIEW_PRICE,
      status: "PENDING",
    },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  let payment
  try {
    payment = await createPayment({
      amountKopecks: AI_REVIEW_PRICE,
      description: `ПОЛКА: AI-ревью «${product.title}»`,
      returnUrl: `${appUrl}/ai-reviews`,
      metadata: { type: "ai_review", aiReviewId: aiReview.id },
      idempotencyKey: `ai-review-${aiReview.id}`,
    })
  } catch (err) {
    await db.aiReview.delete({ where: { id: aiReview.id } })
    console.error("[ai-review] createPayment failed:", err)
    return Response.json({ error: "Платёжная система недоступна" }, { status: 503 })
  }

  await db.aiReview.update({
    where: { id: aiReview.id },
    data: { paymentId: payment.id },
  })

  return Response.json({ confirmationUrl: payment.confirmation?.confirmation_url })
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const reviews = await db.aiReview.findMany({
    where: { requestedBy: session.user.id },
    include: { product: { select: { title: true, slug: true, category: true } } },
    orderBy: { createdAt: "desc" },
  })

  return Response.json(reviews)
}
