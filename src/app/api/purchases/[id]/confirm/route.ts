import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { notifyListingPurchaseConfirmed } from "@/lib/notify"

type RouteParams = { params: Promise<{ id: string }> }
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

// Разработчик подтверждает получение прямой оплаты по заявке (LISTING_FEE):
// AWAITING → DELIVERED, покупателю открывается скачивание.
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const { id } = await params
  const purchase = await db.purchase.findUnique({
    where: { id },
    include: {
      product: { select: { authorId: true, title: true } },
      buyer: { select: { telegramId: true, email: true } },
    },
  })
  if (!purchase) return Response.json({ error: "Заявка не найдена" }, { status: 404 })
  if (purchase.product.authorId !== session.user.id) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }
  if (purchase.status !== "AWAITING") {
    return Response.json({ error: "Заявка не в статусе ожидания" }, { status: 400 })
  }

  await db.$transaction([
    db.purchase.update({ where: { id }, data: { status: "DELIVERED", paidAt: new Date() } }),
    db.product.update({ where: { id: purchase.productId }, data: { salesCount: { increment: 1 } } }),
  ])

  void notifyListingPurchaseConfirmed({
    buyerTelegramId: purchase.buyer.telegramId,
    buyerEmail: purchase.buyer.email,
    productTitle: purchase.product.title,
    purchaseUrl: `${APP_URL}/purchases/${id}`,
  })

  return Response.json({ ok: true })
}
