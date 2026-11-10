import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/current-user"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  const { id } = await params
  const submission = await db.productSubmission.findUnique({ where: { id }, select: { userId: true, productId: true } })
  if (!submission || submission.userId !== user.id) return Response.json({ error: "Черновик не найден" }, { status: 404 })
  return Response.json({ productId: submission.productId }, { headers: { "Cache-Control": "no-store" } })
}
