import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/utils"
import { CATEGORY_LABELS } from "@/types"

export const metadata = { title: "Мои продукты" }

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  PENDING: "На проверке",
  SCAN_FAILED: "Не прошёл скан",
  APPROVED: "Опубликован",
  REJECTED: "Отклонён",
  SUSPENDED: "Приостановлен",
}
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  PENDING: "outline",
  SCAN_FAILED: "destructive",
  APPROVED: "default",
  REJECTED: "destructive",
  SUSPENDED: "secondary",
}

interface PageProps {
  searchParams: Promise<{ submitted?: string }>
}

export default async function DashboardProductsPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { submitted } = await searchParams

  const products = await db.product.findMany({
    where: { authorId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { purchases: true, reviews: true } },
    },
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Мои продукты</h1>
        <Button asChild>
          <Link href="/submit">+ Загрузить продукт</Link>
        </Button>
      </div>

      {submitted && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          ✓ Продукт отправлен на модерацию. Сканирование запущено — статус обновится автоматически.
        </div>
      )}

      {products.length === 0 ? (
        <div className="py-20 text-center space-y-4">
          <p className="text-muted-foreground">У вас ещё нет продуктов.</p>
          <Button asChild>
            <Link href="/submit">Загрузить первый продукт</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-border bg-card p-4 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/dashboard/products/${p.id}`}
                    className="font-medium hover:underline underline-offset-4 truncate"
                  >
                    {p.title}
                  </Link>
                  <Badge variant={STATUS_VARIANTS[p.status] ?? "outline"}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {CATEGORY_LABELS[p.category as keyof typeof CATEGORY_LABELS]} ·{" "}
                  {formatPrice(p.price)} ·{" "}
                  {p._count.purchases} продаж · {p._count.reviews} отзывов
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {p.status === "APPROVED" && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/product/${p.slug}`}>В каталог</Link>
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/products/${p.id}`}>Детали</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
