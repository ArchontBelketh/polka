import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { createPayment } from "@/lib/tbank"
import { ensurePlanRecord, PRO_AMOUNT_KOPECKS } from "@/lib/developer-plan"

export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  await ensurePlanRecord(session.user.id)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const idempotencyKey = `pro-${session.user.id}-${Date.now()}`

  let payment
  try {
    payment = await createPayment({
      amountKopecks: PRO_AMOUNT_KOPECKS,
      description: "ПОЛКА: Pro подписка (1 месяц)",
      returnUrl: `${appUrl}/dashboard`,
      metadata: {
        type: "pro",
        userId: session.user.id,
      },
      idempotencyKey,
    })
  } catch (err) {
    console.error("[developer/pro] createPayment failed:", err)
    return Response.json({ error: "Платёжная система недоступна" }, { status: 503 })
  }

  const confirmationUrl = payment.confirmation?.confirmation_url
  if (!confirmationUrl) {
    return Response.json({ error: "Не удалось получить ссылку на оплату" }, { status: 502 })
  }

  return Response.json({ confirmationUrl })
}
