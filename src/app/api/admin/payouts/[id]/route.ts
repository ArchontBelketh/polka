import { z } from "zod"
import { getCurrentUser } from "@/lib/current-user"
import { transitionPayout, fiscalizePayout } from "@/lib/payouts"
import { FinancialError } from "@/lib/financial-lock"

const schema = z.object({ status: z.enum(["PROCESSING", "PAID", "REJECTED"]) }).strict()

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  if (user.role !== "ADMIN") return Response.json({ error: "Выплаты подтверждает только администратор" }, { status: 403 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Некорректный статус" }, { status: 422 })
  try {
    const { id } = await params
    const result = await transitionPayout(id, parsed.data.status, user.id)
    const receipt = parsed.data.status === "PAID" ? await fiscalizePayout(id) : undefined
    return Response.json({ ok: true, ...result, ...(receipt ? { receipt } : {}) }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    if (error instanceof FinancialError) return Response.json({ error: error.message }, { status: error.status })
    return Response.json({ error: "Не удалось завершить обработку. Проверьте текущий статус перед повторной операцией." }, { status: 503 })
  }
}
