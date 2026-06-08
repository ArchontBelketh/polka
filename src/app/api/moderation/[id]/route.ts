import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const actionSchema = z.object({
  action: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED", "SUSPENDED"]),
  comment: z.string().optional(),
})

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) {
    return Response.json({ error: "Недостаточно прав" }, { status: 403 })
  }

  const { id: productId } = await params
  const product = await db.product.findUnique({ where: { id: productId } })
  if (!product) {
    return Response.json({ error: "Продукт не найден" }, { status: 404 })
  }

  const body = await req.json()
  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { action, comment } = parsed.data

  const newStatus =
    action === "APPROVED" ? "APPROVED"
    : action === "REJECTED" ? "REJECTED"
    : action === "SUSPENDED" ? "SUSPENDED"
    : product.status // CHANGES_REQUESTED keeps current status

  await db.$transaction([
    db.product.update({
      where: { id: productId },
      data: {
        status: newStatus,
        ...(action === "APPROVED" ? { publishedAt: new Date() } : {}),
      },
    }),
    db.moderationLog.create({
      data: {
        productId,
        moderatorId: session.user.id,
        action,
        comment: comment ?? null,
      },
    }),
  ])

  return Response.json({ success: true, status: newStatus })
}
