import { NextRequest } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/current-user"
import { createPayoutForDeveloper } from "@/lib/payouts"
import { FinancialError } from "@/lib/financial-lock"

const schema = z.object({ developerId: z.string().min(1) })

// Админ инициирует выплату разработчику (весь доступный баланс).
export async function POST(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }
  if (me.role !== "ADMIN") {
    return Response.json({ error: "Только для администратора" }, { status: 403 })
  }

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: "Неверные параметры" }, { status: 422 })
  }

  try {
    const result = await createPayoutForDeveloper(parsed.data.developerId)
    if ("error" in result) return Response.json({ error: result.error }, { status: 400 })
    return Response.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof FinancialError) return Response.json({ error: error.message }, { status: error.status })
    return Response.json({ error: "Ответ не получен. Проверьте список выплат перед повторным запросом." }, { status: 503 })
  }
}
