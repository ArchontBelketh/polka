import Link from "next/link"
import { db } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { Star, ShieldCheck, Rocket, ArrowRight } from "lucide-react"
import { EARLY_SELLER_BADGE } from "@/lib/early-seller"

/**
 * Мини-профиль автора на странице товара: ключевые цифры и бейджи,
 * со ссылкой на полный профиль. Данные считаются из реальных продаж/продуктов.
 */
export async function AuthorCard({ authorId }: { authorId: string }) {
  const [author, products] = await Promise.all([
    db.user.findUnique({
      where: { id: authorId },
      select: { id: true, name: true, telegramHandle: true, createdAt: true, isEarlySeller: true, bio: true },
    }),
    db.product.findMany({
      where: { authorId, status: "APPROVED" },
      select: { salesCount: true, rating: true, reviewCount: true, manuallyVerified: true },
    }),
  ])
  if (!author) return null

  const productCount = products.length
  const totalSales = products.reduce((s, p) => s + p.salesCount, 0)
  const totalReviews = products.reduce((s, p) => s + p.reviewCount, 0)
  const avgRating =
    totalReviews > 0 ? products.reduce((s, p) => s + p.rating * p.reviewCount, 0) / totalReviews : 0
  const hasVerified = products.some((p) => p.manuallyVerified)
  const memberSince = new Date(author.createdAt).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
  const initial = (author.name ?? "?")[0].toUpperCase()

  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Об авторе</h2>
        <Link
          href={`/developer/${author.id}`}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline underline-offset-4"
        >
          Все продукты <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="flex items-start gap-4">
        <Link
          href={`/developer/${author.id}`}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted text-xl font-bold text-foreground"
        >
          {initial}
        </Link>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/developer/${author.id}`} className="font-semibold text-foreground hover:underline">
              {author.name ?? "Разработчик"}
            </Link>
            {author.isEarlySeller && (
              <Badge className="gap-1 border-primary/30 bg-primary/15 text-primary">
                <Rocket className="h-3 w-3" />
                {EARLY_SELLER_BADGE}
              </Badge>
            )}
            {hasVerified && (
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="h-3 w-3 text-cyan" />
                Проверенный код
              </Badge>
            )}
          </div>
          {author.telegramHandle && <p className="text-xs text-muted-foreground">@{author.telegramHandle}</p>}
          <p className="text-xs text-muted-foreground">На ПОЛКЕ с {memberSince}</p>
        </div>
      </div>

      {/* Ключевые цифры автора */}
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-background/50 p-3 text-center">
        <div>
          <p className="text-xl font-bold text-foreground">{productCount}</p>
          <p className="text-[11px] text-muted-foreground">
            {productCount === 1 ? "продукт" : productCount < 5 ? "продукта" : "продуктов"}
          </p>
        </div>
        <div>
          <p className="text-xl font-bold text-foreground">{totalSales}</p>
          <p className="text-[11px] text-muted-foreground">продаж</p>
        </div>
        <div>
          <p className="flex items-center justify-center gap-0.5 text-xl font-bold text-foreground">
            {avgRating > 0 ? avgRating.toFixed(1) : "—"}
            {avgRating > 0 && <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {totalReviews > 0 ? `${totalReviews} отз.` : "рейтинг"}
          </p>
        </div>
      </div>

      {author.bio && (
        <p className="line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">{author.bio}</p>
      )}
    </section>
  )
}
