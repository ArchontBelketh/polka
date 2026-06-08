import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { limits } from "@/lib/ratelimit"

const createSchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(10).max(2000),
})

export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("productId")
  if (!productId) {
    return Response.json({ error: "productId обязателен" }, { status: 400 })
  }

  const reviews = await db.review.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      author: { select: { id: true, name: true, telegramHandle: true } },
    },
  })

  return Response.json(reviews)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  if (!limits.reviews(session.user.id)) {
    return Response.json({ error: "Слишком много запросов" }, { status: 429 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { productId, rating, text } = parsed.data
  const userId = session.user.id

  const purchase = await db.purchase.findFirst({
    where: { buyerId: userId, productId, status: { in: ["PAID", "DELIVERED"] } },
  })
  if (!purchase) {
    return Response.json(
      { error: "Оставить отзыв можно только после покупки" },
      { status: 403 }
    )
  }

  const review = await db.$transaction(async (tx) => {
    const existing = await tx.review.findUnique({
      where: { productId_authorId: { productId, authorId: userId } },
    })

    const r = existing
      ? await tx.review.update({
          where: { id: existing.id },
          data: { rating, text },
          include: { author: { select: { id: true, name: true, telegramHandle: true } } },
        })
      : await tx.review.create({
          data: { productId, authorId: userId, rating, text },
          include: { author: { select: { id: true, name: true, telegramHandle: true } } },
        })

    const agg = await tx.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { id: true },
    })
    await tx.product.update({
      where: { id: productId },
      data: {
        rating: Math.round((agg._avg.rating ?? 0) * 10) / 10,
        reviewCount: agg._count.id,
      },
    })

    return r
  })

  return Response.json(review, { status: 201 })
}
