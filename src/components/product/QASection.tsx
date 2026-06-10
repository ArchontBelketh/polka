import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { QAList, type QAItem } from "./QAList"
import { QuestionForm } from "./QuestionForm"

interface QASectionProps {
  productId: string
  productAuthorId: string
  productSlug: string
}

export async function QASection({ productId, productAuthorId, productSlug }: QASectionProps) {
  const session = await auth()
  const userId = session?.user?.id
  const role = (session?.user as { role?: string } | undefined)?.role

  const isAuthor = !!userId && userId === productAuthorId
  const isModerator = role === "MODERATOR" || role === "ADMIN"

  const rows = await db.productQuestion.findMany({
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

  const questions: QAItem[] = rows.map((r) => ({
    id: r.id,
    question: r.question,
    answer: r.answer,
    answeredAt: r.answeredAt ? r.answeredAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    authorName: r.author.name,
  }))

  const unanswered = questions.filter((q) => !q.answer).length

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Вопросы и ответы</h2>
        {questions.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {questions.length} {questionWord(questions.length)}
            {unanswered > 0 && ` · ${unanswered} без ответа`}
          </span>
        )}
      </div>

      <QAList questions={questions} isAuthor={isAuthor} isModerator={isModerator} />

      {/* Ask form — for logged-in users who aren't the product's author */}
      {!userId ? (
        <p className="text-sm text-muted-foreground">
          <Link href={`/login?callbackUrl=/product/${productSlug}`} className="text-primary hover:underline">
            Войдите
          </Link>
          , чтобы задать вопрос автору.
        </p>
      ) : isAuthor ? (
        <p className="text-sm text-muted-foreground">
          Это ваш продукт. Отвечайте на вопросы покупателей выше — они получат уведомление.
        </p>
      ) : (
        <QuestionForm productId={productId} />
      )}
    </section>
  )
}

function questionWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return "вопросов"
  if (mod10 === 1) return "вопрос"
  if (mod10 >= 2 && mod10 <= 4) return "вопроса"
  return "вопросов"
}
