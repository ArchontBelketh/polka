import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { CATEGORY_LABELS } from "@/types"
import { AiReviewCard } from "@/components/product/AiReviewCard"
import type { AiReviewResult } from "@/lib/ai-review/prompt"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Мои AI-ревью" }

const STATUS_LABELS: Record<string, string> = {
  PENDING:    "Ожидает оплаты",
  PROCESSING: "Анализируется",
  DONE:       "Готово",
  FAILED:     "Ошибка",
}
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING:    "outline",
  PROCESSING: "secondary",
  DONE:       "default",
  FAILED:     "destructive",
}

export default async function AiReviewsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login?callbackUrl=/ai-reviews")

  const reviews = await db.aiReview.findMany({
    where: { requestedBy: session.user.id },
    include: { product: { select: { title: true, slug: true, category: true } } },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <a href="/purchases" className="hover:underline">← Мои покупки</a>
        </p>
        <h1 className="text-2xl font-semibold">Мои AI-ревью</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Независимые аудиты кода продуктов, заказанные вами.
        </p>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/30 px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">Вы ещё не заказывали AI-ревью.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Перейдите на страницу продукта и нажмите «Заказать ревью».
          </p>
        </div>
      ) : (
        <ul className="space-y-6">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-lg border border-border bg-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <a
                    href={`/product/${review.product.slug}`}
                    className="font-semibold hover:underline"
                  >
                    {review.product.title}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORY_LABELS[review.product.category as keyof typeof CATEGORY_LABELS]}
                    {" · "}
                    {new Date(review.createdAt).toLocaleDateString("ru-RU", {
                      day: "numeric", month: "long", year: "numeric",
                    })}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANTS[review.status] ?? "outline"} className="shrink-0">
                  {STATUS_LABELS[review.status] ?? review.status}
                </Badge>
              </div>

              {review.status === "DONE" && review.result && (
                <AiReviewCard
                  result={review.result as unknown as AiReviewResult}
                  createdAt={review.createdAt}
                />
              )}

              {review.status === "PROCESSING" && (
                <p className="text-sm text-muted-foreground">
                  Анализ выполняется. Обновите страницу через несколько минут.
                </p>
              )}

              {review.status === "FAILED" && (
                <p className="text-sm text-destructive">
                  Не удалось выполнить анализ. Пожалуйста, обратитесь в поддержку.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
