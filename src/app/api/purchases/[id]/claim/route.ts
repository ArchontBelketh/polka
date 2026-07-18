import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { notifyClaimFiled } from "@/lib/notify"

// Окно подачи претензии — по умолчанию 7 дней с момента покупки (оферта, п. 10).
const CLAIM_WINDOW_DAYS = parseInt(process.env.CLAIM_WINDOW_DAYS ?? "7", 10)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

const schema = z.object({
  text: z.string().trim().min(20, "Опишите проблему подробнее (минимум 20 символов)").max(2000),
})

type RouteParams = { params: Promise<{ id: string }> }

// Покупатель подаёт претензию по покупке. Ведёт её поддержка (тикет CLAIM),
// разработчик получает уведомление. Денежная часть — вне площадки.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const { id } = await params
  const purchase = await db.purchase.findUnique({
    where: { id },
    include: {
      product: {
        select: {
          title: true,
          authorId: true,
          author: { select: { telegramId: true, email: true } },
        },
      },
    },
  })
  if (!purchase) {
    return Response.json({ error: "Покупка не найдена" }, { status: 404 })
  }
  if (purchase.buyerId !== session.user.id) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }
  if (purchase.status !== "PAID" && purchase.status !== "DELIVERED") {
    return Response.json({ error: "Претензию можно подать только по оплаченной покупке" }, { status: 400 })
  }

  // Проверка окна подачи
  const start = purchase.paidAt ?? purchase.createdAt
  const deadline = new Date(start.getTime() + CLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  if (new Date() > deadline) {
    return Response.json(
      { error: `Срок подачи претензии истёк (${CLAIM_WINDOW_DAYS} дней с момента покупки)` },
      { status: 400 },
    )
  }

  // Одна претензия на покупку
  const existing = await db.supportTicket.findFirst({
    where: { purchaseId: id, category: "CLAIM" },
    select: { id: true },
  })
  if (existing) {
    return Response.json(
      { error: "Претензия по этой покупке уже подана", ticketId: existing.id },
      { status: 409 },
    )
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const ticket = await db.supportTicket.create({
    data: {
      authorId: session.user.id,
      subject: `Претензия: ${purchase.product.title}`,
      category: "CLAIM",
      productId: purchase.productId,
      purchaseId: id,
      messages: { create: { authorId: session.user.id, text: parsed.data.text, isStaff: false } },
    },
  })

  void notifyClaimFiled({
    developerTelegramId: purchase.product.author.telegramId,
    developerEmail: purchase.product.author.email,
    productTitle: purchase.product.title,
    threadUrl: `${APP_URL}/dashboard/messages/${id}`,
    preview: parsed.data.text,
  })

  return Response.json({ ticketId: ticket.id }, { status: 201 })
}
