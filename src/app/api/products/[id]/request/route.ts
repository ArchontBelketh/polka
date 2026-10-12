import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { notifyListingPurchaseRequested } from "@/lib/notify"

type RouteParams = { params: Promise<{ id: string }> }
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

// Заявка покупателя на продукт «Тариф за размещение» (прямая оплата разработчику).
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const { id } = await params
  const product = await db.product.findUnique({
    where: { id },
    include: {
      author: {
        select: { telegramId: true, email: true, payoutProfile: { select: { paymentLink: true } } },
      },
    },
  })
  if (!product || product.status !== "APPROVED") {
    return Response.json({ error: "Продукт недоступен для покупки" }, { status: 404 })
  }
  if (product.authorId === session.user.id) {
    return Response.json({ error: "Нельзя купить собственный продукт" }, { status: 400 })
  }
  if (!product.author.payoutProfile?.paymentLink) {
    return Response.json({ error: "У автора не указана ссылка для оплаты" }, { status: 400 })
  }

  const existing = await db.purchase.findFirst({
    where: {
      buyerId: session.user.id,
      productId: id,
      status: { in: ["AWAITING", "PAID", "DELIVERED"] },
    },
    select: { id: true },
  })
  if (existing) {
    return Response.json({ error: "Заявка по этому продукту уже оформлена", purchaseId: existing.id }, { status: 409 })
  }

  const purchase = await db.purchase.create({
    data: {
      buyerId: session.user.id,
      productId: id,
      amount: product.price,
      status: "AWAITING",
    },
  })

  void notifyListingPurchaseRequested({
    developerTelegramId: product.author.telegramId,
    developerEmail: product.author.email,
    productTitle: product.title,
    confirmUrl: `${APP_URL}/dashboard/confirmations`,
  })

  return Response.json({ purchaseId: purchase.id }, { status: 201 })
}
