import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { limits } from "@/lib/ratelimit"
import { notifyNewMessage } from "@/lib/notify"
import { containsContactInfo, CONTACT_BLOCK_MESSAGE } from "@/lib/contact-filter"

type RouteParams = { params: Promise<{ id: string }> }

const sendSchema = z.object({
  text: z.string().trim().min(1, "Пустое сообщение").max(2000),
})

const PARTICIPANT_STATUSES = ["PAID", "DELIVERED"]
const WRITABLE_STATUSES = ["PAID", "DELIVERED"]
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

async function loadThread(id: string) {
  return db.purchase.findUnique({
    where: { id },
    include: {
      buyer: { select: { id: true, telegramId: true, email: true } },
      product: {
        select: {
          title: true,
          slug: true,
          authorId: true,
          author: { select: { id: true, telegramId: true, email: true } },
        },
      },
    },
  })
}

// GET — list messages (oldest first) and mark incoming as read
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const { id } = await params
  const purchase = await loadThread(id)

  const userId = session.user.id
  const isBuyer = purchase?.buyerId === userId
  const isAuthor = purchase?.product.authorId === userId
  if (!purchase || (!isBuyer && !isAuthor)) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }
  if (!PARTICIPANT_STATUSES.includes(purchase.status)) {
    return Response.json({ error: "Переписка недоступна" }, { status: 403 })
  }

  // Mark messages from the other party as read
  await db.purchaseMessage.updateMany({
    where: { purchaseId: id, senderId: { not: userId }, isRead: false },
    data: { isRead: true },
  })

  const messages = await db.purchaseMessage.findMany({
    where: { purchaseId: id },
    orderBy: { createdAt: "asc" },
    take: 500,
    select: { id: true, text: true, senderId: true, createdAt: true },
  })

  return Response.json({
    messages,
    canWrite: WRITABLE_STATUSES.includes(purchase.status),
    status: purchase.status,
  })
}

// POST — send a message
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }
  const userId = session.user.id

  if (!limits.messages(userId)) {
    return Response.json({ error: "Слишком много сообщений. Попробуйте позже." }, { status: 429 })
  }

  const body = await req.json()
  const parsed = sendSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }
  const text = parsed.data.text

  if (containsContactInfo(text)) {
    return Response.json({ error: CONTACT_BLOCK_MESSAGE }, { status: 400 })
  }

  const { id } = await params
  const purchase = await loadThread(id)

  const isBuyer = purchase?.buyerId === userId
  const isAuthor = purchase?.product.authorId === userId
  if (!purchase || (!isBuyer && !isAuthor)) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }
  if (!WRITABLE_STATUSES.includes(purchase.status)) {
    return Response.json({ error: "Переписка закрыта" }, { status: 403 })
  }

  // Anti-spam: only notify if the recipient has no prior unread message from me
  const priorUnread = await db.purchaseMessage.count({
    where: { purchaseId: id, senderId: userId, isRead: false },
  })

  const message = await db.$transaction(async (tx) => {
    const m = await tx.purchaseMessage.create({
      data: { purchaseId: id, senderId: userId, text },
      select: { id: true, text: true, senderId: true, createdAt: true },
    })
    await tx.purchase.update({
      where: { id },
      data: { lastMessageAt: new Date() },
    })
    return m
  })

  if (priorUnread === 0) {
    const recipient = isBuyer ? purchase.product.author : purchase.buyer
    const threadUrl = isBuyer
      ? `${APP_URL}/dashboard/messages/${id}`
      : `${APP_URL}/purchases/${id}`
    void notifyNewMessage({
      recipientTelegramId: recipient?.telegramId ?? null,
      recipientEmail: recipient?.email,
      productTitle: purchase.product.title,
      threadUrl,
      preview: text,
    })
  }

  return Response.json(message, { status: 201 })
}
