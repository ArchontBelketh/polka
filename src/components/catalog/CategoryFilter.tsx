"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { CATEGORY_LABELS, CATEGORY_ICONS, type Category } from "@/types"

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[]

export function CategoryFilter() {
  const router = useRouter()
  const params = useSearchParams()
  const active = params.get("category") as Category | null

  function select(cat: Category | null) {
    const next = new URLSearchParams(params.toString())
    if (cat) {
      next.set("category", cat)
    } else {
      next.delete("category")
    }
    next.delete("page")
    router.push(`/catalog?${next.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => select(null)}
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
          onClick={() => select(cat)}
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
  )
}
