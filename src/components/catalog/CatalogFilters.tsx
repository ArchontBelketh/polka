"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { CATEGORY_LABELS, type Category } from "@/types"
import { PRODUCT_LANGUAGES, PRODUCT_PLATFORMS } from "@/lib/product-specification"
import { CATALOG_SORT_OPTIONS, catalogUrl, parseCatalogQuery, type CatalogQuery } from "@/lib/catalog-query"
import { Button } from "@/components/ui/button"

const fieldClass = "mt-1.5 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"

export function CatalogFilters({ query }: { query: CatalogQuery }) {
  const router = useRouter()
  const [error, setError] = useState("")
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>
    const parsed = parseCatalogQuery(values)
    if (!parsed.success) { setError(parsed.error); return }
    setError("")
    router.push(catalogUrl(parsed.value, { page: 1 }))
  }
  return (
    <section aria-label="Фильтры готового кода" className="space-y-4 rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
      <nav aria-label="Назначение продукта" className="flex flex-wrap gap-2" data-testid="category-filter">
        <CategoryLink href={catalogUrl(query, { category: undefined, page: 1 })} active={!query.category}>Все задачи</CategoryLink>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => <CategoryLink key={key} href={catalogUrl(query, { category: key as Category, page: 1 })} active={query.category === key}>{label}</CategoryLink>)}
      </nav>
      <form action="/catalog" method="get" onSubmit={submit} className="space-y-4" aria-label="Подобрать готовый код">
        <input type="hidden" name="category" value={query.category ?? ""} />
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0 text-xs text-muted-foreground sm:col-span-2 lg:col-span-3"><label htmlFor="catalog-q">Поиск по названию и описанию</label><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" /><input id="catalog-q" name="q" type="search" defaultValue={query.q ?? ""} maxLength={200} placeholder="Например, бот записи или обработка Excel" className={cn(fieldClass, "pl-9 text-foreground")} /></div></div>
          <div className="min-w-0 text-xs text-muted-foreground"><label htmlFor="catalog-sort">Сортировка</label><select id="catalog-sort" name="sort" defaultValue={query.sort} className={cn(fieldClass, "text-foreground")}>{CATALOG_SORT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
          <FilterSelect name="language" label="Язык" value={query.language} options={PRODUCT_LANGUAGES} empty="Любой язык" />
          <FilterSelect name="platform" label="Платформа" value={query.platform} options={PRODUCT_PLATFORMS} empty="Любая платформа" />
          <FilterSelect name="license" label="Лицензия" value={query.license} options={{ personal: "Личная", commercial: "Коммерческая", other: "Другая / уточняется" }} empty="Любая лицензия" />
          <label htmlFor="catalog-compatibility" className="min-w-0 text-xs text-muted-foreground">Совместимость<input id="catalog-compatibility" name="compatibility" defaultValue={query.compatibility ?? ""} maxLength={200} placeholder="Например, Excel 2021" className={cn(fieldClass, "text-foreground")} /></label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <fieldset className="min-w-0 max-w-full"><legend className="mb-1.5 text-xs text-muted-foreground">Цена, ₽</legend><div className="flex gap-2"><label htmlFor="catalog-min" className="min-w-0"><span className="sr-only">Цена от</span><input id="catalog-min" name="minPrice" inputMode="decimal" defaultValue={query.minPrice ?? ""} placeholder="От" maxLength={11} className={cn(fieldClass, "mt-0 w-28 max-w-full")} /></label><label htmlFor="catalog-max" className="min-w-0"><span className="sr-only">Цена до</span><input id="catalog-max" name="maxPrice" inputMode="decimal" defaultValue={query.maxPrice ?? ""} placeholder="До" maxLength={11} className={cn(fieldClass, "mt-0 w-28 max-w-full")} /></label></div></fieldset>
          <Button type="submit" className="min-h-11">Применить фильтры</Button><Link href="/catalog" className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground">Сбросить всё</Link>
        </div>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      </form>
      <p className="text-xs leading-relaxed text-muted-foreground">Характеристики указаны авторами. Товары без этих сведений остаются в общем каталоге.</p>
    </section>
  )
}

function FilterSelect({ name, label, value, options, empty }: { name: string; label: string; value?: string; options: Record<string, string>; empty: string }) {
  return <div className="min-w-0 text-xs text-muted-foreground"><label htmlFor={`catalog-${name}`}>{label}</label><select id={`catalog-${name}`} name={name} defaultValue={value ?? ""} className={cn(fieldClass, "text-foreground")}><option value="">{empty}</option>{Object.entries(options).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></div>
}
function CategoryLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <Link href={href} aria-current={active ? "page" : undefined} className={cn("rounded-full border px-3 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan", active ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-border text-muted-foreground hover:text-foreground")}>{children}</Link>
}
