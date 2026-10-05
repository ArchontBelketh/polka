import { notFound } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { ProductCard } from "@/components/catalog/ProductCard"
import { CATEGORY_LABELS } from "@/types"
import { Star, Package, ShoppingCart, Pencil, Rocket, ShieldCheck, Trophy, Flame } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { EARLY_SELLER_BADGE } from "@/lib/early-seller"
import type { Metadata } from "next"

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const user = await db.user.findUnique({ where: { id }, select: { name: true } })
  if (!user) return {}
  return { title: `${user.name ?? "Разработчик"} — продукты на ПОЛКЕ` }
}

interface Achievement {
  icon: LucideIcon
  label: string
  desc: string
  cls: string
}

export default async function DeveloperPage({ params }: PageProps) {
  const { id } = await params

  const [session, developer] = await Promise.all([
    auth(),
    db.user.findUnique({
      where: { id, role: { in: ["DEVELOPER", "ADMIN"] } },
      select: {
        id:             true,
        name:           true,
        telegramHandle: true,
        bio:            true,
        createdAt:      true,
        isEarlySeller:  true,
        earlySellerNo:  true,
      },
    }),
  ])

  const isOwn = session?.user?.id === id

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
      manuallyVerified: true,
      author: { select: { id: true, name: true, telegramHandle: true } },
    },
  })

  const totalSales = products.reduce((sum, p) => sum + p.salesCount, 0)
  const totalReviews = products.reduce((sum, p) => sum + p.reviewCount, 0)
  // Рейтинг, взвешенный по числу отзывов (честнее простого среднего).
  const avgRating =
    totalReviews > 0
      ? products.reduce((sum, p) => sum + p.rating * p.reviewCount, 0) / totalReviews
      : 0
  const hasVerified = products.some((p) => p.manuallyVerified)

  // Ачивки — только заслуженные, по реальным данным.
  const achievements: Achievement[] = []
  if (developer.isEarlySeller) {
    achievements.push({
      icon: Rocket,
      label: developer.earlySellerNo ? `${EARLY_SELLER_BADGE} №${developer.earlySellerNo}` : EARLY_SELLER_BADGE,
      desc: "Один из первых продавцов ПОЛКИ",
      cls: "text-violet",
    })
  }
  if (hasVerified) {
    achievements.push({
      icon: ShieldCheck,
      label: "Проверенный код",
      desc: "Есть продукты, прошедшие ручную проверку модератором",
      cls: "text-cyan",
    })
  }
  if (totalSales >= 50) {
    achievements.push({ icon: Trophy, label: "Топ-продавец", desc: "Более 50 продаж", cls: "text-amber-400" })
  } else if (totalSales >= 10) {
    achievements.push({ icon: Flame, label: "Популярный автор", desc: "Более 10 продаж", cls: "text-orange-400" })
  }
  if (avgRating >= 4.5 && totalReviews >= 5) {
    achievements.push({ icon: Star, label: "Высокий рейтинг", desc: "Средняя оценка 4.5★ и выше", cls: "text-yellow-400" })
  }
  if (products.length >= 5) {
    achievements.push({ icon: Package, label: "Плодовитый автор", desc: "5+ опубликованных продуктов", cls: "text-primary" })
  }

  const categoryStats = products.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + 1
    return acc
  }, {})

  const initial = (developer.name ?? "?")[0].toUpperCase()
  const memberSince = new Date(developer.createdAt).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* Profile header */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-r from-primary/30 via-violet/20 to-cyan/20 sm:h-28" />
        <div className="px-6 pb-6">
          <div className="-mt-10 flex flex-wrap items-end gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-card bg-muted text-3xl font-bold text-foreground shadow-lg">
              {initial}
            </div>
            <div className="flex-1 space-y-1 pb-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold">{developer.name ?? "Разработчик"}</h1>
                {developer.isEarlySeller && (
                  <Badge className="border-primary/30 bg-primary/15 text-primary">{EARLY_SELLER_BADGE}</Badge>
                )}
                {isOwn && (
                  <Link
                    href="/settings"
                    className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Pencil className="h-3 w-3" /> Редактировать
                  </Link>
                )}
              </div>
              {developer.telegramHandle && (
                <p className="text-sm text-muted-foreground">@{developer.telegramHandle}</p>
              )}
              <p className="text-xs text-muted-foreground">На ПОЛКЕ с {memberSince}</p>
            </div>
          </div>

          {developer.bio && (
            <p className="mt-4 max-w-2xl whitespace-pre-line text-sm text-muted-foreground">{developer.bio}</p>
          )}

          {/* Achievements */}
          {achievements.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {achievements.map((a) => (
                <div
                  key={a.label}
                  title={a.desc}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm"
                >
                  <a.icon className={`h-4 w-4 ${a.cls}`} />
                  <span className="font-medium">{a.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <Package className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
          <p className="text-2xl font-bold">{products.length}</p>
          <p className="text-xs text-muted-foreground">
            {products.length === 1 ? "продукт" : products.length < 5 ? "продукта" : "продуктов"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <ShoppingCart className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
          <p className="text-2xl font-bold">{totalSales}</p>
          <p className="text-xs text-muted-foreground">продаж</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <Star className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
          <p className="text-2xl font-bold">{avgRating > 0 ? avgRating.toFixed(1) : "—"}</p>
          <p className="text-xs text-muted-foreground">
            {totalReviews > 0 ? `рейтинг · ${totalReviews} отз.` : "средний рейтинг"}
          </p>
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
        <p className="py-8 text-center text-sm text-muted-foreground">
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
