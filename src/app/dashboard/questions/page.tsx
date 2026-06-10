import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { AnswerForm } from "@/components/product/AnswerForm"
import { MessageCircleQuestion, ArrowLeft } from "lucide-react"

export const metadata = { title: "Вопросы — ПОЛКА" }

export default async function DashboardQuestionsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user) redirect("/login")
  if (user.role === "MODERATOR") redirect("/admin")
  if (!["DEVELOPER", "ADMIN"].includes(user.role)) redirect("/purchases")

  const products = await db.product.findMany({
    where: { authorId: session.user.id },
    select: { id: true },
  })
  const productIds = products.map((p) => p.id)

  const [unanswered, answeredCount] = await Promise.all([
    db.productQuestion.findMany({
      where: { productId: { in: productIds }, isHidden: false, answer: null },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: {
        id: true,
        question: true,
        createdAt: true,
        author: { select: { name: true } },
        product: { select: { title: true, slug: true } },
      },
    }),
    db.productQuestion.count({
      where: { productId: { in: productIds }, isHidden: false, answer: { not: null } },
    }),
  ])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        В кабинет
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Вопросы покупателей</h1>
        {answeredCount > 0 && (
          <span className="text-sm text-muted-foreground">отвечено: {answeredCount}</span>
        )}
      </div>

      {unanswered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground space-y-2">
          <MessageCircleQuestion className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p>Нет неотвеченных вопросов.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {unanswered.length} {unanswered.length === 1 ? "вопрос ждёт" : "вопросов ждут"} ответа.
            Покупатель получит уведомление, когда вы ответите.
          </p>
          {unanswered.map((q) => (
            <div key={q.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
              <Link
                href={`/product/${q.product.slug}`}
                className="text-xs font-medium text-primary hover:underline"
              >
                {q.product.title}
              </Link>
              <p className="text-sm text-foreground whitespace-pre-wrap">{q.question}</p>
              <p className="text-xs text-muted-foreground">
                {q.author.name ?? "Пользователь"} · {new Date(q.createdAt).toLocaleDateString("ru-RU")}
              </p>
              <AnswerForm questionId={q.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
