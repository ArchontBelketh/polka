import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const { id } = await params
  const user = await db.user.findUnique({ where: { id: session.user.id } })
  const isStaff = user?.role === "ADMIN" || user?.role === "MODERATOR"

  const ticket = await db.supportTicket.findUnique({
    where: { id },
    include: {
      author: { select: { name: true, email: true, role: true } },
      product: { select: { id: true, title: true, slug: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, email: true, role: true } } },
      },
    },
  })

  if (!ticket) return Response.json({ error: "Тикет не найден" }, { status: 404 })
  if (!isStaff && ticket.authorId !== session.user.id) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }

  return Response.json(ticket)
}

const replySchema = z.object({
  text: z.string().min(1),
})

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const { id } = await params
  const user = await db.user.findUnique({ where: { id: session.user.id } })
  const isStaff = user?.role === "ADMIN" || user?.role === "MODERATOR"

  const ticket = await db.supportTicket.findUnique({ where: { id } })
  if (!ticket) return Response.json({ error: "Тикет не найден" }, { status: 404 })
  if (!isStaff && ticket.authorId !== session.user.id) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }
  if (ticket.status === "CLOSED") {
    return Response.json({ error: "Тикет закрыт" }, { status: 409 })
  }

  const body = await req.json()
  const parsed = replySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const [message] = await db.$transaction([
    db.ticketMessage.create({
      data: {
        ticketId: id,
        authorId: session.user.id,
        text: parsed.data.text,
        isStaff,
      },
    }),
    db.supportTicket.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        // When staff replies, move to IN_PROGRESS; when user replies on resolved, reopen
        ...(isStaff && ticket.status === "OPEN" ? { status: "IN_PROGRESS" } : {}),
        ...(!isStaff && ticket.status === "RESOLVED" ? { status: "IN_PROGRESS" } : {}),
      },
    }),
  ])

  return Response.json(message, { status: 201 })
}

const patchSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
})

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["ADMIN", "MODERATOR"].includes(user.role)) {
    return Response.json({ error: "Недостаточно прав" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422 })

  const ticket = await db.supportTicket.update({
    where: { id },
    data: { status: parsed.data.status, updatedAt: new Date() },
  })

  return Response.json(ticket)
}
