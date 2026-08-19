import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createPayment } from "@/lib/tbank"
import { SLOT_PACKAGES, ensurePlanRecord } from "@/lib/developer-plan"

const body = z.object({ slots: z.union([z.literal(1), z.literal(5), z.literal(15)]) })

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const parsed = body.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: "Неверные параметры" }, { status: 422 })
  }

  const pkg = SLOT_PACKAGES.find((p) => p.slots === parsed.data.slots)!

  await ensurePlanRecord(session.user.id)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const idempotencyKey = `slots-${session.user.id}-${Date.now()}`

  let payment
  try {
    payment = await createPayment({
      amountKopecks: pkg.amountKopecks,
      description: `ПОЛКА: ${pkg.label} для разработчика`,
      returnUrl: `${appUrl}/dashboard`,
      metadata: {
        type: "slots",
        userId: session.user.id,
        slotsAdded: String(pkg.slots),
      },
      idempotencyKey,
    })
  } catch (err) {
    console.error("[developer/slots] createPayment failed:", err)
    return Response.json({ error: "Платёжная система недоступна" }, { status: 503 })
  }

  const confirmationUrl = payment.confirmation?.confirmation_url
  if (!confirmationUrl) {
    return Response.json({ error: "Не удалось получить ссылку на оплату" }, { status: 502 })
  }

  await db.slotPurchase.create({
    data: {
      userId: session.user.id,
      slotsAdded: pkg.slots,
      amount: pkg.amountKopecks,
      paymentId: payment.id,
    },
  })

  return Response.json({ confirmationUrl })
}
