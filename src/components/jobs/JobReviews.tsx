import Link from "next/link"
import { publicJobReviews } from "@/lib/jobs/read"

export async function JobReviews({ userId }: { userId: string }) {
  const reviews = await publicJobReviews(userId)
  return <section className="space-y-4"><h2 className="text-xl font-semibold">Отзывы по завершённым заказам</h2><p className="text-sm text-muted-foreground">История заказов учитывается отдельно от оценок готового кода.</p>{!reviews.length && <p className="text-sm text-muted-foreground">Отзывов по заказам пока нет.</p>}{reviews.map(review => <article key={review.id} className="rounded-xl border border-border bg-card p-5 space-y-2"><p className="text-sm font-semibold">{review.author.name ?? "Участник заказа"} · {review.rating}/5</p><Link href={`/orders/${review.job.id}`} className="text-xs text-cyan hover:underline">{review.job.title}</Link><p className="text-sm whitespace-pre-wrap break-words">{review.text}</p></article>)}</section>
}
