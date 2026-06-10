import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { limits } from "@/lib/ratelimit"
import { containsContactInfo, CONTACT_BLOCK_MESSAGE } from "@/lib/contact-filter"
import { notifyNewQuestion } from "@/lib/notify"

type RouteParams = { params: Promise<{ id: string }> }

const askSchema = z.object({
  question: z.string().trim().min(5, "Вопрос слишком короткий").max(1000),
})

// GET — public list of non-hidden questions, newest first
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id: productId } = await params

  const questions = await db.productQuestion.findMany({
    where: { productId, isHidden: false },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      question: true,
      answer: true,
      answeredAt: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  })

  return Response.json(questions)
}

// POST — ask a question (any authenticated user except the product's own author)
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  if (!limits.questions(session.user.id)) {
    return Response.json(
      { error: "Слишком много вопросов. Не более 5 в час." },
      { status: 429 },
    )
  }

  const body = await req.json()
  const parsed = askSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }
  const question = parsed.data.question

  if (containsContactInfo(question)) {
    return Response.json({ error: CONTACT_BLOCK_MESSAGE }, { status: 400 })
  }

  const { id: productId } = await params
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      title: true,
      slug: true,
      status: true,
      author: { select: { telegramId: true, email: true } },
      authorId: true,
    },
  })

  if (!product || product.status !== "APPROVED") {
    return Response.json({ error: "Продукт не найден" }, { status: 404 })
  }
  if (product.authorId === session.user.id) {
    return Response.json({ error: "Нельзя задать вопрос своему продукту" }, { status: 400 })
  }

  const created = await db.productQuestion.create({
    data: { productId, authorId: session.user.id, question },
    select: { id: true, question: true, createdAt: true },
  })

  // Fire-and-forget notification to the developer
  void notifyNewQuestion({
    developerTelegramId: product.author.telegramId,
    developerEmail: product.author.email,
    productTitle: product.title,
    productSlug: product.slug,
    question,
  })

  return Response.json(created, { status: 201 })
}
