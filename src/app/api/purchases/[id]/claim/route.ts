import { z } from "zod"
import { getCurrentUser } from "@/lib/current-user"
import { filePurchaseClaim } from "@/lib/purchase-claims"
import { FinancialError } from "@/lib/financial-lock"
import { notifyClaimFiled } from "@/lib/notify"

const schema = z.object({ text: z.string().trim().min(20, "Опишите проблему подробнее (минимум 20 символов)").max(2000) }).strict()
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  try {
    const { id } = await params
    const result = await filePurchaseClaim(user.id, id, parsed.data.text)
    if (!result.created) return Response.json({ error: "Претензия по этой покупке уже подана", ticketId: result.ticketId }, { status: 409 })
    if (result.notice) void notifyClaimFiled({ ...result.notice, threadUrl: `${APP_URL}/dashboard/messages/${id}`, preview: parsed.data.text }).catch(() => { console.error("Claim notification failed") })
    return Response.json({ ticketId: result.ticketId }, { status: 201 })
  } catch (error) {
    if (error instanceof FinancialError) return Response.json({ error: error.message }, { status: error.status })
    return Response.json({ error: "Не удалось сохранить претензию. Проверьте её наличие перед повтором." }, { status: 503 })
  }
}
