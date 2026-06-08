import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const toggleSchema = z.object({ productId: z.string().min(1) })

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const items = await db.wishlist.findMany({
    where: { userId: session.user.id },
    include: { product: { select: { id: true, slug: true, title: true, price: true } } },
    orderBy: { createdAt: "desc" },
  })

  return Response.json(items)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = toggleSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { productId } = parsed.data
  const userId = session.user.id

  const existing = await db.wishlist.findUnique({
    where: { userId_productId: { userId, productId } },
  })

  if (existing) {
    await db.wishlist.delete({ where: { id: existing.id } })
    return Response.json({ saved: false })
  }

  await db.wishlist.create({ data: { userId, productId } })
  return Response.json({ saved: true }, { status: 201 })
}
