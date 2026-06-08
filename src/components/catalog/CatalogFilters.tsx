"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { Search, SlidersHorizontal, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { CATEGORY_LABELS, CATEGORY_ICONS, type Category } from "@/types"

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[]

const SORT_OPTIONS = [
  { value: "popular",    label: "Популярные"   },
  { value: "newest",     label: "Новые"         },
  { value: "rating",     label: "По рейтингу"  },
  { value: "price_asc",  label: "Дешевле"      },
  { value: "price_desc", label: "Дороже"       },
]

export function CatalogFilters() {
  const router = useRouter()
  const params = useSearchParams()

  const active        = params.get("category") as Category | null
  const currentSort   = params.get("sort") ?? "popular"
  const currentQ      = params.get("q") ?? ""
  const currentMin    = params.get("minPrice") ?? ""
  const currentMax    = params.get("maxPrice") ?? ""

  const [searchVal, setSearchVal] = useState(currentQ)
  const [minPrice,  setMinPrice]  = useState(currentMin)
  const [maxPrice,  setMaxPrice]  = useState(currentMax)

  function buildUrl(overrides: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null || v === "") next.delete(k)
      else next.set(k, v)
    }
    next.delete("page")
    return `/catalog?${next.toString()}`
  }

  function selectCategory(cat: Category | null) {
    router.push(buildUrl({ category: cat }))
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    router.push(buildUrl({ q: searchVal.trim() || null }))
  }

  function clearSearch() {
    setSearchVal("")
    router.push(buildUrl({ q: null }))
  }

  function changeSort(sort: string) {
    router.push(buildUrl({ sort: sort === "popular" ? null : sort }))
  }

  function applyPrice() {
    router.push(buildUrl({ minPrice: minPrice || null, maxPrice: maxPrice || null }))
  }

  function clearPrice() {
    setMinPrice("")
    setMaxPrice("")
    router.push(buildUrl({ minPrice: null, maxPrice: null }))
  }

  const hasPriceFilter = !!currentMin || !!currentMax

  return (
    <div className="space-y-3">
      {/* Row: search + sort + price */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <form onSubmit={submitSearch} className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder="Поиск..."
            className="w-44 pl-8 pr-7 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          {searchVal && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </form>

        {/* Sort */}
        <select
          value={currentSort}
          onChange={(e) => changeSort(e.target.value)}
          className="text-sm rounded-md border border-border bg-background px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Price range */}
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            type="number"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="от"
            min={0}
            className="w-16 px-2 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="до"
            min={0}
            className="w-16 px-2 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <span className="text-xs text-muted-foreground">₽</span>
          <button
            onClick={applyPrice}
            className="text-xs px-2 py-1.5 rounded-md border border-border bg-background hover:bg-muted transition-colors"
          >
            →
          </button>
          {hasPriceFilter && (
            <button
              onClick={clearPrice}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Сбросить фильтр цены"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => selectCategory(null)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm transition-colors",
            !active
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          Все
        </button>
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => selectCategory(cat)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors",
              active === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <span>{CATEGORY_ICONS[cat]}</span>
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>
    </div>
  )
}
