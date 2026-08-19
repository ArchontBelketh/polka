import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createPayment } from "@/lib/tbank"
import { saleModelForKopecks, listingFeeKopecks } from "@/lib/tariffs"

type RouteParams = { params: Promise<{ id: string }> }

// Оплата разработчиком единоразового тарифа за размещение (модель LISTING_FEE).
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const { id } = await params
  const product = await db.product.findUnique({ where: { id } })
  if (!product) return Response.json({ error: "Продукт не найден" }, { status: 404 })
  if (product.authorId !== session.user.id) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }
  if (saleModelForKopecks(product.price) !== "LISTING_FEE") {
    return Response.json({ error: "Тариф за размещение применяется только к продуктам от порога" }, { status: 400 })
  }
  if (product.listingFeePaidAt) {
    return Response.json({ error: "Тариф за размещение уже оплачен" }, { status: 409 })
  }

  const amount = listingFeeKopecks(product.price)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  let payment
  try {
    payment = await createPayment({
      amountKopecks: amount,
      description: `ПОЛКА: тариф за размещение «${product.title}»`,
      returnUrl: `${appUrl}/dashboard/products/${id}`,
      metadata: { type: "listing_fee", productId: id },
      idempotencyKey: `listingfee-${id}-${Date.now()}`,
    })
  } catch (err) {
    console.error("[listing-fee] createPayment failed:", err)
    return Response.json({ error: "Платёжная система недоступна" }, { status: 503 })
  }

  const confirmationUrl = payment.confirmation?.confirmation_url
  if (!confirmationUrl) {
    return Response.json({ error: "Не удалось получить ссылку на оплату" }, { status: 502 })
  }
  return Response.json({ confirmationUrl })
}
