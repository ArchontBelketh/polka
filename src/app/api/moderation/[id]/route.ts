import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { notifyProductApproved, notifyProductRejected, notifySecurityRecall } from "@/lib/notify"

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("APPROVED"), comment: z.string().optional() }),
  z.object({ action: z.literal("REJECTED"), comment: z.string().optional() }),
  z.object({ action: z.literal("CHANGES_REQUESTED"), comment: z.string().optional() }),
  z.object({ action: z.literal("SUSPENDED"), comment: z.string().min(1, "Укажите причину отзыва") }),
  z.object({ action: z.literal("RESTORED"), comment: z.string().optional() }),
  z.object({ action: z.literal("VERIFIED"), verified: z.boolean() }),
  z.object({ action: z.literal("SECURITY_NOTICE"), comment: z.string().optional() }),
])

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) {
    return Response.json({ error: "Недостаточно прав" }, { status: 403 })
  }

  const { id: productId } = await params
  const product = await db.product.findUnique({ where: { id: productId } })
  if (!product) {
    return Response.json({ error: "Продукт не найден" }, { status: 404 })
  }

  const body = await req.json()
  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  // ── "Проверено вручную" toggle — doesn't change moderation status ──────────
  if (parsed.data.action === "VERIFIED") {
    const verified = parsed.data.verified
    await db.$transaction([
      db.product.update({
        where: { id: productId },
        data: { manuallyVerified: verified, verifiedAt: verified ? new Date() : null },
      }),
      db.moderationLog.create({
        data: {
          productId,
          moderatorId: session.user.id,
          action: verified ? "VERIFIED" : "UNVERIFIED",
          comment: verified ? "Работоспособность подтверждена" : "Отметка снята",
        },
      }),
    ])
    return Response.json({ success: true, manuallyVerified: verified })
  }

  // ── Отзыв по безопасности — рассылка покупателям, статус не меняем ──────────
  if (parsed.data.action === "SECURITY_NOTICE") {
    const purchases = await db.purchase.findMany({
      where: { productId, status: { in: ["PAID", "DELIVERED"] } },
      select: { buyer: { select: { id: true, telegramId: true, email: true } } },
    })
    // Дедуп по покупателю — один человек мог купить продукт не раз
    const byUser = new Map<string, { telegramId: string | null; email: string | null }>()
    for (const p of purchases) {
      byUser.set(p.buyer.id, { telegramId: p.buyer.telegramId, email: p.buyer.email })
    }
    const buyers = [...byUser.values()]

    await db.moderationLog.create({
      data: {
        productId,
        moderatorId: session.user.id,
        action: "SECURITY_NOTICE",
        comment: parsed.data.comment ?? `Уведомлено покупателей: ${buyers.length}`,
      },
    })

    void notifySecurityRecall({ productTitle: product.title, buyers })

    return Response.json({ success: true, notified: buyers.length })
  }

  const { action, comment } = parsed.data

  const newStatus =
    action === "APPROVED" ? "APPROVED"
    : action === "REJECTED" ? "REJECTED"
    : action === "SUSPENDED" ? "SUSPENDED"
    : action === "RESTORED" ? "APPROVED"
    : product.status // CHANGES_REQUESTED keeps current status

  await db.$transaction([
    db.product.update({
      where: { id: productId },
      data: {
        status: newStatus,
        ...(action === "APPROVED" || action === "RESTORED" ? { publishedAt: new Date() } : {}),
        ...(action === "SUSPENDED" ? { publishedAt: null } : {}),
      },
    }),
    db.moderationLog.create({
      data: {
        productId,
        moderatorId: session.user.id,
        action,
        comment: comment ?? null,
      },
    }),
  ])

  const developer = await db.user.findUnique({
    where: { id: product.authorId },
    select: { telegramId: true },
  })

  if (action === "APPROVED" || action === "RESTORED") {
    void notifyProductApproved({
      developerTelegramId: developer?.telegramId ?? null,
      productTitle: product.title,
      productSlug: product.slug,
    })
  } else if (action === "REJECTED" || action === "SUSPENDED") {
    void notifyProductRejected({
      developerTelegramId: developer?.telegramId ?? null,
      productTitle: product.title,
      comment,
    })
  }

  return Response.json({ success: true, status: newStatus })
}
