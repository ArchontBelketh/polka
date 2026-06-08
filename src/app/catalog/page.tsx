import { Suspense } from "react"
import { db } from "@/lib/db"
import { CategoryFilter } from "@/components/catalog/CategoryFilter"
import { ProductCard } from "@/components/catalog/ProductCard"
import type { Category } from "@/types"

interface CatalogPageProps {
  searchParams: Promise<{ category?: string; q?: string; page?: string }>
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://polka.app"

export const metadata = {
  title: "Каталог — ПОЛКА",
  description: "Готовые программные продукты: Telegram-боты, парсеры, Excel-скрипты, автоматизация",
  openGraph: {
    title: "Каталог — ПОЛКА",
    description: "Готовые программные продукты: Telegram-боты, парсеры, Excel-скрипты, автоматизация",
    url: `${APP_URL}/catalog`,
    images: [{ url: `${APP_URL}/og-default.svg`, width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Каталог — ПОЛКА",
    description: "Готовые программные продукты для бизнеса",
    images: [`${APP_URL}/og-default.svg`],
  },
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const { category, q, page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? "1", 10))
  const limit = 20
  const skip = (page - 1) * limit

  const where = {
    status: "APPROVED" as const,
    ...(category ? { category: category as Category } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { shortDesc: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      skip,
      take: limit,
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
        status: true,
        author: { select: { id: true, name: true, telegramHandle: true } },
      },
    }),
    db.product.count({ where }),
  ])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Каталог</h1>
        <span className="text-sm text-muted-foreground">
          {total} {plural(total, "продукт", "продукта", "продуктов")}
        </span>
      </div>

      <Suspense>
        <CategoryFilter />
      </Suspense>

      {products.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          {q || category ? "По вашему запросу ничего не найдено" : "Продуктов пока нет"}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {total > limit && (
        <div className="flex justify-center gap-2 pt-4">
          {page > 1 && (
            <a
              href={`/catalog?${new URLSearchParams({ ...(q ? { q } : {}), ...(category ? { category } : {}), page: String(page - 1) })}`}
              className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted"
            >
              ← Назад
            </a>
          )}
          {page * limit < total && (
            <a
              href={`/catalog?${new URLSearchParams({ ...(q ? { q } : {}), ...(category ? { category } : {}), page: String(page + 1) })}`}
              className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted"
            >
              Вперёд →
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}
