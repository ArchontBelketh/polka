import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { runScan } from "@/lib/scanner"
import { canPublish } from "@/lib/payout-profile"
import { saleModelForKopecks } from "@/lib/tariffs"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const productId = searchParams.get("productId")
  if (!productId) {
    return Response.json({ error: "productId обязателен" }, { status: 400 })
  }

  const product = await db.product.findUnique({ where: { id: productId } })
  if (!product) {
    return Response.json({ error: "Продукт не найден" }, { status: 404 })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  const isOwner = product.authorId === session.user.id
  const isAdmin = user?.role === "ADMIN" || user?.role === "MODERATOR"

  if (!isOwner && !isAdmin) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }

  // Гейт публикации: разработчик обязан заполнить правовой статус и реквизиты
  // (оферта, п. 6). Админ/модератор — в обход.
  if (isOwner && !isAdmin) {
    const profile = await db.payoutProfile.findUnique({ where: { userId: session.user.id } })
    if (!canPublish(profile)) {
      return Response.json(
        {
          error: "Продукт сохранён как черновик. Для публикации укажите правовой статус, реквизиты и ссылку для оплаты покупателем в разделе «Реквизиты» — покупатель платит вам напрямую.",
          code: "REQUISITES_REQUIRED",
        },
        { status: 403 },
      )
    }
  }

  // Снапшот модели продажи на момент публикации (по цене и порогу).
  await db.product.update({
    where: { id: productId },
    data: { saleModel: saleModelForKopecks(product.price) },
  })

  // Fire and forget — response returns immediately
  runScan(productId).catch((err) =>
    console.error(`[scanner] productId=${productId}`, err),
  )

  return Response.json({ message: "Сканирование запущено", productId }, { status: 202 })
}
