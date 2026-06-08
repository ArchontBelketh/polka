import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

type RouteParams = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const { id } = await params
  const product = await db.product.findUnique({ where: { id } })

  if (!product) {
    return Response.json({ error: "Продукт не найден" }, { status: 404 })
  }
  if (product.authorId !== session.user.id) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }
  if (!["DRAFT", "REJECTED"].includes(product.status)) {
    return Response.json({ error: "Нельзя удалить продукт с текущим статусом" }, { status: 409 })
  }

  const hasPurchases = await db.purchase.count({ where: { productId: id } })
  if (hasPurchases > 0) {
    return Response.json({ error: "Нельзя удалить продукт с покупками" }, { status: 409 })
  }

  // Delete in dependency order (no cascade on ModerationLog/Review)
  await db.$transaction([
    db.moderationLog.deleteMany({ where: { productId: id } }),
    db.review.deleteMany({ where: { productId: id } }),
    db.wishlist.deleteMany({ where: { productId: id } }),
    db.product.delete({ where: { id } }),
  ])

  return Response.json({ success: true })
}
