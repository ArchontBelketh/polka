import { notFound } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { getPublicDeveloper } from "@/lib/public-developer"
import { InviteDeveloper } from "@/components/developers/InviteDeveloper"
import { ExposureTracker } from "@/components/developers/ExposureTracker"
import { exposureToken } from "@/lib/developers/metrics"
import { SPECIALIZATIONS, AVAILABILITY_LABELS, type Specialization } from "@/lib/developer-profile"
import { auth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { ProductCard } from "@/components/catalog/ProductCard"
import { JobReviews } from "@/components/jobs/JobReviews"
import { CATEGORY_LABELS } from "@/types"
import { Star, Package, ShoppingCart, Pencil, ShieldCheck, Trophy, Flame, ExternalLink } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { plural, FORMS, monthYearGenitive } from "@/lib/plural"
import type { Metadata } from "next"

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const user = await getPublicDeveloper(id)
  if (!user) return { title: "Профиль недоступен", robots: { index: false, follow: false } }
  return { title: `${user.name ?? "Разработчик"} — профиль на ПОЛКЕ`, description: user.headline || "Навыки, проекты и готовый код разработчика на CYBERПОЛКЕ." }
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
    getPublicDeveloper(id),
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
  const memberSince = monthYearGenitive(new Date(developer.createdAt))

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      <ExposureTracker token={exposureToken("PROFILE_OPEN", [id])} profileId={id} />
      {/* Profile header */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-r from-primary/30 via-violet/20 to-cyan/20 sm:h-28" />
        <div className="px-6 pb-6">
          <div className="-mt-10 flex flex-wrap items-end gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-card bg-muted text-3xl font-bold text-foreground shadow-lg">
              {initial}
            </div>
            <div className="min-w-0 flex-1 space-y-1 pb-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="max-w-full break-words text-2xl font-bold">{developer.name ?? "Разработчик"}</h1>
                {isOwn && (
                  <Link
                    href="/dashboard/profile"
                    className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Pencil className="h-3 w-3" /> Редактировать
                  </Link>
                )}
              </div>
              {developer.headline && <p className="text-sm text-foreground break-words">{developer.headline}</p>}
              <p className={`inline-flex items-center gap-2 text-xs ${developer.availability === "AVAILABLE" ? "text-cyan" : "text-muted-foreground"}`}><span aria-hidden="true" className={`h-2 w-2 rounded-full ${developer.availability === "AVAILABLE" ? "bg-cyan" : developer.availability === "LIMITED" ? "bg-amber-400" : "bg-muted-foreground"}`} />{AVAILABILITY_LABELS[developer.availability]}</p>
              <p className="text-xs text-muted-foreground">На ПОЛКЕ с {memberSince}</p>
            </div>
          </div>

          {developer.bio && (
            <p className="mt-4 max-w-2xl whitespace-pre-line break-words text-sm text-muted-foreground">{developer.bio}</p>
          )}

          {developer.specializations.length > 0 && <div className="mt-5 flex flex-wrap gap-2" aria-label="Направления работы">{developer.specializations.filter((item) => item in SPECIALIZATIONS).map((item) => <Badge key={item} variant="secondary">{SPECIALIZATIONS[item as Specialization]}</Badge>)}</div>}
          {developer.skills.length > 0 && <div className="mt-4"><h2 className="text-sm font-medium">Навыки</h2><ul className="mt-2 flex flex-wrap gap-2">{developer.skills.map((skill) => <li key={skill} className="max-w-full break-words rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">{skill}</li>)}</ul></div>}

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

      {developer.portfolio.length > 0 && <section aria-labelledby="public-portfolio" className="space-y-4"><div><h2 id="public-portfolio" className="text-xl font-semibold">Портфолио</h2><p className="mt-1 text-xs text-muted-foreground">Проекты и описание вклада добавлены разработчиком.</p></div><div className="grid gap-4 sm:grid-cols-2">{developer.portfolio.map((item, index) => <article key={index} className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-5"><h3 className="font-medium break-words">{item.title}</h3>{item.description && <p className="whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">{item.description}</p>}{item.url && <a href={item.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="inline-flex items-center gap-2 text-sm text-cyan underline-offset-4 hover:underline">Посмотреть проект <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" /></a>}</article>)}</div></section>}

      <section aria-labelledby="code-heading" className="space-y-4">
        <div><h2 id="code-heading" className="text-xl font-semibold">Готовый код</h2><p className="mt-1 text-xs text-muted-foreground">Продажи и оценки ниже относятся к товарам магазина. История заказной разработки учитывается отдельно.</p></div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <Package className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
          <p className="text-2xl font-bold">{products.length}</p>
          <p className="text-xs text-muted-foreground">{plural(products.length, FORMS.product)}</p>
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
          <h3 className="text-lg font-semibold">Опубликованные продукты</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
      </section>

      <JobReviews userId={id} />
      {!isOwn && developer.listed && developer.availability !== "UNAVAILABLE" && <InviteDeveloper developerId={id} signedIn={!!session?.user} />}
      <p className="text-xs text-muted-foreground">
        <Link href="/developers" className="hover:underline">← Каталог разработчиков</Link>
      </p>
    </div>
  )
}
