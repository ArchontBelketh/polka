import { notFound } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { ProductCard } from "@/components/catalog/ProductCard"
import { CATEGORY_LABELS } from "@/types"
import { Star, Package, ShoppingCart } from "lucide-react"
import type { Metadata } from "next"

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const user = await db.user.findUnique({ where: { id }, select: { name: true } })
  if (!user) return {}
  return { title: `${user.name ?? "Разработчик"} — ПОЛКА` }
}

export default async function DeveloperPage({ params }: PageProps) {
  const { id } = await params

  const developer = await db.user.findUnique({
    where: { id, role: { in: ["DEVELOPER", "ADMIN"] } },
    select: {
      id: true,
      name: true,
      telegramHandle: true,
      createdAt: true,
    },
  })

  if (!developer) notFound()

  const products = await db.product.findMany({
    where: { authorId: id, status: "APPROVED" },
    orderBy: { salesCount: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      shortDesc: true,
      category: true,
      price: true,
      rating: true,
      reviewCount: true,
      salesCount: true,
      screenshots: true,
      techStack: true,
      status: true,
      author: { select: { id: true, name: true, telegramHandle: true } },
    },
  })

  const totalSales = products.reduce((sum, p) => sum + p.salesCount, 0)
  const avgRating =
    products.length > 0
      ? products.reduce((sum, p) => sum + p.rating, 0) / products.length
      : 0

  const categoryStats = products.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* Profile header */}
      <div className="flex items-start gap-6">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground shrink-0">
          {(developer.name ?? "?")[0].toUpperCase()}
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{developer.name ?? "Разработчик"}</h1>
          {developer.telegramHandle && (
            <p className="text-sm text-muted-foreground">@{developer.telegramHandle}</p>
          )}
          <p className="text-xs text-muted-foreground">
            На платформе с {new Date(developer.createdAt).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <Package className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-2xl font-bold">{products.length}</p>
          <p className="text-xs text-muted-foreground">
            {products.length === 1 ? "продукт" : products.length < 5 ? "продукта" : "продуктов"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <ShoppingCart className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-2xl font-bold">{totalSales}</p>
          <p className="text-xs text-muted-foreground">продаж</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <Star className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-2xl font-bold">
            {avgRating > 0 ? avgRating.toFixed(1) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">средний рейтинг</p>
        </div>
      </div>

      {/* Category tags */}
      {Object.keys(categoryStats).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(categoryStats).map(([cat, count]) => (
            <Badge key={cat} variant="secondary">
              {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]} · {count}
            </Badge>
          ))}
        </div>
      )}

      {/* Products */}
      {products.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          У этого разработчика пока нет опубликованных продуктов.
        </p>
      ) : (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Продукты</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        <Link href="/catalog" className="hover:underline">← Вернуться в каталог</Link>
      </p>
    </div>
  )
}
