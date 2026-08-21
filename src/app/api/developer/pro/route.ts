import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { initPayment } from "@/lib/payments"
import { ensurePlanRecord, PRO_AMOUNT_KOPECKS } from "@/lib/developer-plan"

export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  await ensurePlanRecord(session.user.id)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  let payment
  try {
    payment = await initPayment({
      type: "pro",
      payload: { userId: session.user.id },
      amountKopecks: PRO_AMOUNT_KOPECKS,
      description: "ПОЛКА: Pro подписка (1 месяц)",
      returnUrl: `${appUrl}/dashboard`,
      userId: session.user.id,
    })
  } catch (err) {
    console.error("[developer/pro] createPayment failed:", err)
    return Response.json({ error: "Платёжная система недоступна" }, { status: 503 })
  }

  const confirmationUrl = payment.confirmationUrl
  if (!confirmationUrl) {
    return Response.json({ error: "Не удалось получить ссылку на оплату" }, { status: 502 })
  }

  return Response.json({ confirmationUrl })
}
