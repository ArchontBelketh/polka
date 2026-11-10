import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/current-user"
import { limits } from "@/lib/ratelimit"
import { isEmailVerified, EMAIL_NOT_VERIFIED_MESSAGE } from "@/lib/email-verify"
import { saveVerifiedReview } from "@/lib/store-transactions"

const createSchema = z.object({ productId: z.string().min(1), rating: z.number().int().min(1).max(5), text: z.string().trim().min(10).max(2000) }).strict()
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("productId")
  if (!productId) return Response.json({ error: "productId обязателен" }, { status: 400 })
  return Response.json(await db.review.findMany({ where: { productId }, orderBy: { createdAt: "desc" }, take: 50, include: { author: { select: { id: true, name: true, telegramHandle: true } } } }))
}
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  if (!limits.reviews(user.id)) return Response.json({ error: "Слишком много запросов" }, { status: 429 })
  if (!(await isEmailVerified(user.id))) return Response.json({ error: EMAIL_NOT_VERIFIED_MESSAGE }, { status: 403 })
  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Оценка должна быть от 1 до 5, текст — от 10 до 2000 символов" }, { status: 422 })
  const { productId, rating, text } = parsed.data
  const result = await saveVerifiedReview(user.id, productId, rating, text)
  return result.status === 201 ? Response.json(result.review, { status: 201 }) : Response.json({ error: result.error }, { status: result.status })
}
