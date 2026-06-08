import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const createSchema = z.object({
  subject: z.string().min(5).max(200),
  category: z.enum(["APPEAL", "PURCHASE", "BUG", "OTHER"]),
  text: z.string().min(10),
  productId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { subject, category, text, productId } = parsed.data

  try {
    // Verify product ownership if productId provided
    if (productId) {
      const product = await db.product.findUnique({ where: { id: productId } })
      if (!product || product.authorId !== session.user.id) {
        return Response.json({ error: "Продукт не найден" }, { status: 404 })
      }
    }

    const userRecord = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
    const isStaff = userRecord?.role === "ADMIN" || userRecord?.role === "MODERATOR"

    const ticket = await db.supportTicket.create({
      data: {
        authorId: session.user.id,
        subject,
        category,
        productId: productId ?? null,
        messages: {
          create: { authorId: session.user.id, text, isStaff },
        },
      },
    })
    return Response.json({ id: ticket.id }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/support]", err)
    return Response.json({ error: "Ошибка при создании обращения" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  const isStaff = user?.role === "ADMIN" || user?.role === "MODERATOR"

  const { searchParams } = req.nextUrl
  const status = searchParams.get("status") ?? undefined

  const tickets = await db.supportTicket.findMany({
    where: {
      ...(isStaff ? {} : { authorId: session.user.id }),
      ...(status ? { status: status as never } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      author: { select: { name: true, email: true } },
      product: { select: { title: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
  })

  return Response.json(tickets)
}
