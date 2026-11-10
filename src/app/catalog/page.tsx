import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { CatalogFilters } from "@/components/catalog/CatalogFilters"
import { ProductCard } from "@/components/catalog/ProductCard"
import { CATEGORY_LABELS } from "@/types"
import { parseCatalogQuery, catalogWhere, catalogOrderBy, catalogUrl, hasCatalogFacets, type CatalogSearchParams } from "@/lib/catalog-query"

interface CatalogPageProps { searchParams: Promise<CatalogSearchParams> }
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

export async function generateMetadata({ searchParams }: CatalogPageProps): Promise<Metadata> {
  const parsed = parseCatalogQuery(await searchParams)
  const query = parsed.success ? parsed.value : { sort: "popular" as const, page: 1 }
  const category = query.category
  let noindex = !parsed.success || hasCatalogFacets(query)
  if (category && !noindex) {
    try { noindex = await db.product.count({ where: { status: "APPROVED", category } }) === 0 }
    catch { noindex = true }
  }
  const canonical = catalogUrl({ sort: "popular", page: 1, category })
  const title = category ? `${CATEGORY_LABELS[category]} — готовый код` : "Готовый код"
  const description = "Готовые программные решения: боты, парсеры, интеграции и автоматизация. Поиск по языку, платформе, совместимости и лицензии."
  return {
    title, description, alternates: { canonical },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title, description, url: `${APP_URL}${canonical}`, images: [{ url: `${APP_URL}/og-default.svg`, width: 1200, height: 630 }], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [`${APP_URL}/og-default.svg`] },
  }
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const parsed = parseCatalogQuery(await searchParams)
  if (!parsed.success) return <div className="mx-auto max-w-7xl px-4 py-8 space-y-6"><h1 className="text-2xl font-semibold">Готовый код</h1><CatalogFilters query={{ sort: "popular", page: 1 }} /><p role="alert" className="text-sm text-red-400">Не удалось применить фильтры: {parsed.error}</p><Link href="/catalog" className="text-cyan underline">Сбросить фильтры</Link></div>
  const query = parsed.value
  const limit = 20
  const where = catalogWhere(query)
  const result = await (async () => {
    try {
      const [products, total, session] = await Promise.all([
        db.product.findMany({
          where, skip: (query.page - 1) * limit, take: limit, orderBy: catalogOrderBy(query),
          select: {
            id: true, slug: true, title: true, shortDesc: true, category: true, price: true, rating: true,
            reviewCount: true, salesCount: true, screenshots: true, techStack: true, manuallyVerified: true,
            specification: { select: { languages: true, platforms: true } },
          },
        }),
        db.product.count({ where }), auth(),
      ])
      const wishlist = session?.user?.id ? await db.wishlist.findMany({ where: { userId: session.user.id }, select: { productId: true } }) : []
      return { ok: true as const, products, total, wishlist: new Set(wishlist.map((item) => item.productId)) }
    } catch { return { ok: false as const } }
  })()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold text-foreground">Готовый код</h1><p className="mt-2 text-sm text-muted-foreground">Подберите решение по задаче и проверьте условия перед покупкой.</p></div>{result.ok && <p className="text-sm text-muted-foreground">Найдено: {result.total}</p>}</div>
      <CatalogFilters key={catalogUrl(query)} query={query} />
      {!result.ok ? <div role="alert" className="rounded-2xl border border-border bg-card p-6 space-y-3"><h2 className="font-semibold">Каталог временно недоступен</h2><p className="text-sm text-muted-foreground">Не удалось загрузить товары. Повторите попытку позже; выбранные фильтры сохранены в адресе страницы.</p><Link href={catalogUrl(query)} className="inline-block text-sm text-cyan underline">Повторить загрузку</Link></div>
        : result.products.length === 0 ? <div className="rounded-2xl border border-dashed border-border px-4 py-14 text-center space-y-3"><p className="text-muted-foreground">{query.category || hasCatalogFacets(query) ? "По выбранным фильтрам ничего не найдено" : "Опубликованных продуктов пока нет"}</p><Link href="/catalog" className="inline-block text-sm text-cyan underline">Сбросить фильтры</Link><p className="text-xs text-muted-foreground">Товары без указанных характеристик доступны в общем каталоге.</p></div>
        : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{result.products.map((product) => <ProductCard key={product.id} product={product} isWishlisted={result.wishlist.has(product.id)} />)}</div>}
      {result.ok && (result.total > limit || query.page > 1) && <nav aria-label="Страницы каталога" className="flex flex-wrap items-center justify-center gap-3 pt-4">{query.page > 1 && <Link href={catalogUrl(query, { page: query.page - 1 })} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">← Назад</Link>}<span className="text-xs text-muted-foreground">Страница {query.page}</span>{query.page * limit < result.total && <Link href={catalogUrl(query, { page: query.page + 1 })} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">Вперёд →</Link>}</nav>}
    </div>
  )
}
