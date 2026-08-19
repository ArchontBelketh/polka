import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createRefund } from "@/lib/tbank"
import { saleModelForKopecks } from "@/lib/tariffs"
import type { Prisma } from "@/generated/prisma/client"

type RouteParams = { params: Promise<{ id: string }> }

// Операторский возврат по обоснованной претензии (оферта 10.3). Только «Комиссия».
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }
  const admin = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (admin?.role !== "ADMIN") {
    return Response.json({ error: "Возврат оформляет только администратор" }, { status: 403 })
  }

  const { id } = await params
  const purchase = await db.purchase.findUnique({
    where: { id },
    include: { product: { select: { price: true, authorId: true, saleModel: true } } },
  })
  if (!purchase) return Response.json({ error: "Покупка не найдена" }, { status: 404 })
  if (purchase.status === "REFUNDED") {
    return Response.json({ error: "Возврат уже оформлен" }, { status: 409 })
  }
  if (purchase.status !== "PAID" && purchase.status !== "DELIVERED") {
    return Response.json({ error: "Возврат недоступен для этого статуса" }, { status: 400 })
  }
  const model = purchase.product.saleModel ?? saleModelForKopecks(purchase.product.price)
  if (model !== "COMMISSION") {
    return Response.json({ error: "Возврат через площадку доступен только для модели «Комиссия»" }, { status: 400 })
  }
  if (!purchase.paymentId) {
    return Response.json({ error: "У покупки нет платежа для возврата" }, { status: 400 })
  }

  // Возврат в платёжной системе
  try {
    await createRefund(purchase.paymentId, purchase.amount, `refund-${id}-${Date.now()}`)
  } catch (err) {
    console.error("[refund] createRefund failed:", err)
    return Response.json({ error: "Не удалось выполнить возврат в платёжной системе" }, { status: 502 })
  }

  const ops: Prisma.PrismaPromise<unknown>[] = [
    db.purchase.update({ where: { id }, data: { status: "REFUNDED" } }),
    db.product.update({ where: { id: purchase.productId }, data: { salesCount: { decrement: 1 } } }),
    // Закрываем связанную претензию
    db.supportTicket.updateMany({
      where: { purchaseId: id, category: "CLAIM", status: { in: ["OPEN", "IN_PROGRESS"] } },
      data: { status: "RESOLVED" },
    }),
  ]
  // Если разработчику уже зачислено — удерживаем сумму (баланс может уйти в минус, 10.3 / 6.5)
  if (purchase.creditedAt && purchase.developerAmount) {
    ops.push(
      db.user.update({
        where: { id: purchase.product.authorId },
        data: { balance: { decrement: purchase.developerAmount } },
      }),
    )
  }
  await db.$transaction(ops)

  return Response.json({ ok: true })
}
