import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { containsContactInfo, CONTACT_BLOCK_MESSAGE } from "@/lib/contact-filter"
import { notifyQuestionAnswered } from "@/lib/notify"

type RouteParams = { params: Promise<{ id: string }> }

const answerSchema = z.object({
  answer: z.string().trim().min(2, "Ответ слишком короткий").max(2000),
})

// PATCH — answer or edit the answer; only the product's author may do this
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = answerSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }
  const answer = parsed.data.answer

  if (containsContactInfo(answer)) {
    return Response.json({ error: CONTACT_BLOCK_MESSAGE }, { status: 400 })
  }

  const { id } = await params
  const question = await db.productQuestion.findUnique({
    where: { id },
    select: {
      id: true,
      product: {
        select: { authorId: true, title: true, slug: true },
      },
      author: { select: { telegramId: true, email: true } },
    },
  })

  if (!question) {
    return Response.json({ error: "Вопрос не найден" }, { status: 404 })
  }
  if (question.product.authorId !== session.user.id) {
    return Response.json({ error: "Отвечать может только автор продукта" }, { status: 403 })
  }

  const updated = await db.productQuestion.update({
    where: { id },
    data: { answer, answeredAt: new Date() },
    select: { id: true, answer: true, answeredAt: true },
  })

  // Notify the person who asked
  void notifyQuestionAnswered({
    askerTelegramId: question.author.telegramId,
    askerEmail: question.author.email,
    productTitle: question.product.title,
    productSlug: question.product.slug,
    answer,
  })

  return Response.json(updated)
}

// DELETE — hide a question (moderation); only MODERATOR/ADMIN
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const role = (session.user as { role?: string }).role
  if (role !== "MODERATOR" && role !== "ADMIN") {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }

  const { id } = await params
  const existing = await db.productQuestion.findUnique({ where: { id }, select: { id: true } })
  if (!existing) {
    return Response.json({ error: "Вопрос не найден" }, { status: 404 })
  }

  await db.productQuestion.update({ where: { id }, data: { isHidden: true } })

  return Response.json({ success: true })
}
