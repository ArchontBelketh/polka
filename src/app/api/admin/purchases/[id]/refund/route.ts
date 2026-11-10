import { getCurrentUser } from "@/lib/current-user"
import { refundPurchase } from "@/lib/refunds"
import { FinancialError } from "@/lib/financial-lock"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  if (user.role !== "ADMIN") return Response.json({ error: "Возврат оформляет только администратор" }, { status: 403 })
  if (!process.env.TBANK_TERMINAL_KEY || !process.env.TBANK_PASSWORD) return Response.json({ error: "Платёжный провайдер не настроен" }, { status: 503 })
  try {
    const result = await refundPurchase((await params).id, user.id)
    return Response.json(result, { status: result.pending ? 202 : 200, headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    if (error instanceof FinancialError) return Response.json({ error: error.message }, { status: error.status })
    return Response.json({ error: "Не удалось завершить сверку возврата. Повторите проверку; новая отправка автоматически не выполняется." }, { status: 503 })
  }
}
