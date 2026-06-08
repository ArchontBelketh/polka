import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { notifyDisputeOpened } from "@/lib/notify"

const openSchema = z.object({
  purchaseId: z.string().min(1),
  reason: z.string().min(10).max(1000),
})

const resolveSchema = z.object({
  purchaseId: z.string().min(1),
  resolution: z.enum(["REFUNDED", "DELIVERED"]),
  comment: z.string().optional(),
})

// POST /api/disputes — buyer opens a dispute OR moderator resolves it
// Body discriminated by `action` field
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open"), ...openSchema.shape }),
  z.object({ action: z.literal("resolve"), ...resolveSchema.shape }),
])

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  const isMod = user?.role === "MODERATOR" || user?.role === "ADMIN"

  const disputes = await db.purchase.findMany({
    where: isMod ? { status: "DISPUTED" } : { buyerId: session.user.id, status: "DISPUTED" },
    include: {
      product: { select: { id: true, title: true, slug: true } },
      buyer: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return Response.json(disputes)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const userId = session.user.id

  if (parsed.data.action === "open") {
    const { purchaseId, reason } = parsed.data

    const purchase = await db.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        product: {
          include: { author: { select: { telegramId: true, name: true } } },
        },
      },
    })

    if (!purchase) {
      return Response.json({ error: "Покупка не найдена" }, { status: 404 })
    }
    if (purchase.buyerId !== userId) {
      return Response.json({ error: "Нет доступа" }, { status: 403 })
    }
    if (!["PAID", "DELIVERED"].includes(purchase.status)) {
      return Response.json(
        { error: "Спор можно открыть только для оплаченной покупки" },
        { status: 400 }
      )
    }
    if (purchase.status === "DISPUTED") {
      return Response.json({ error: "Спор уже открыт" }, { status: 409 })
    }

    await db.purchase.update({
      where: { id: purchaseId },
      data: { status: "DISPUTED" },
    })

    await notifyDisputeOpened({
      developerTelegramId: purchase.product.author.telegramId,
      productTitle: purchase.product.title,
      reason,
    })

    return Response.json({ success: true, status: "DISPUTED" })
  }

  // resolve — moderator only
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) {
    return Response.json({ error: "Недостаточно прав" }, { status: 403 })
  }

  const { purchaseId, resolution, comment: _comment } = parsed.data

  const purchase = await db.purchase.findUnique({ where: { id: purchaseId } })
  if (!purchase) {
    return Response.json({ error: "Покупка не найдена" }, { status: 404 })
  }
  if (purchase.status !== "DISPUTED") {
    return Response.json({ error: "Покупка не находится в споре" }, { status: 400 })
  }

  await db.purchase.update({
    where: { id: purchaseId },
    data: { status: resolution },
  })

  return Response.json({ success: true, status: resolution })
}
