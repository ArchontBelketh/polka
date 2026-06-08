import { db } from "@/lib/db"
import { Star } from "lucide-react"

interface ReviewListProps {
  productId: string
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-4 w-4 ${n <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  )
}

export async function ReviewList({ productId }: ReviewListProps) {
  const reviews = await db.review.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { author: { select: { id: true, name: true } } },
  })

  if (reviews.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Отзывов пока нет. Будьте первым!
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {reviews.map((r) => (
        <div key={r.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StarRating rating={r.rating} />
              <span className="text-sm font-medium">
                {r.author.name ?? "Пользователь"}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(r.createdAt).toLocaleDateString("ru-RU")}
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{r.text}</p>
        </div>
      ))}
    </div>
  )
}
