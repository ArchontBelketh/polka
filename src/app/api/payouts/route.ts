import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const requestSchema = z.object({
  amount: z.number().int().positive(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const payouts = await db.payout.findMany({
    where: { developerId: session.user.id },
    orderBy: { requestedAt: "desc" },
    take: 50,
  })

  return Response.json(payouts)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["DEVELOPER", "ADMIN"].includes(user.role)) {
    return Response.json({ error: "Только разработчики могут запрашивать вывод" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { amount } = parsed.data

  if (user.balance < amount) {
    return Response.json({ error: "Недостаточно средств на балансе" }, { status: 400 })
  }

  const userId = session.user.id
  const payout = await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { balance: { decrement: amount } },
    })
    return tx.payout.create({
      data: {
        developerId: userId,
        amount,
        status: "PENDING",
      },
    })
  })

  return Response.json(payout, { status: 201 })
}
