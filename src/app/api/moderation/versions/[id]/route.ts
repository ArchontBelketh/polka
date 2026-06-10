import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { notifyNewVersion, notifyVersionRejected } from "@/lib/notify"

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("APPROVED"), comment: z.string().optional() }),
  z.object({ action: z.literal("REJECTED"), comment: z.string().min(1, "Укажите причину отказа") }),
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

  const { id: versionId } = await params

  const version = await db.productVersion.findUnique({
    where: { id: versionId },
    include: {
      product: {
        select: {
          title: true,
          slug: true,
          authorId: true,
          author: { select: { telegramId: true, email: true, name: true } },
        },
      },
    },
  })

  if (!version) {
    return Response.json({ error: "Версия не найдена" }, { status: 404 })
  }
  if (version.status !== "PENDING") {
    return Response.json({ error: "Версия уже рассмотрена" }, { status: 422 })
  }

  const body = await req.json()
  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { action, comment } = parsed.data

  await db.productVersion.update({
    where: { id: versionId },
    data: {
      status: action,
      moderatorComment: comment ?? null,
    },
  })

  // A new approved version replaces the verified file — drop the manual badge
  if (action === "APPROVED") {
    await db.product.update({
      where: { id: version.productId },
      data: { manuallyVerified: false, verifiedAt: null },
    })
  }

  const { product } = version

  if (action === "APPROVED") {
    // Notify all buyers of this product
    void (async () => {
      const purchases = await db.purchase.findMany({
        where: {
          productId: version.productId,
          status: { in: ["PAID", "DELIVERED"] },
        },
        select: { buyer: { select: { telegramId: true, email: true } } },
      })

      const buyers = purchases.map((p) => ({
        telegramId: p.buyer.telegramId,
        email: p.buyer.email,
      }))

      if (buyers.length > 0) {
        await notifyNewVersion({
          productTitle: product.title,
          productSlug: product.slug,
          version: version.version,
          changelog: version.changelog,
          buyers,
        })
      }
    })()
  } else {
    // Notify developer of rejection
    void notifyVersionRejected({
      developerTelegramId: product.author.telegramId,
      developerEmail: product.author.email,
      productTitle: product.title,
      version: version.version,
      comment,
    })
  }

  return Response.json({ success: true, status: action })
}
