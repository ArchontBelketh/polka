import Link from "next/link"
import { CATEGORY_LABELS, CATEGORY_ICONS, type Category } from "@/types"

const ORDER: Category[] = ["TELEGRAM", "PARSER", "EXCEL", "AUTOMATION", "WEB"]

interface CategoryGridProps {
  counts: Record<Category, number>
}

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

export function CategoryGrid({ counts }: CategoryGridProps) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16">
      <h2 className="text-center text-2xl font-bold text-foreground">Категории</h2>
      <p className="mt-2 text-center text-muted-foreground">Найдите готовое решение под свою задачу</p>

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {ORDER.map((cat) => {
          const count = counts[cat] ?? 0
          return (
            <Link
              key={cat}
              href={`/catalog?category=${cat}`}
              className="group flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-6 text-center transition-colors hover:border-primary/50"
            >
              <span className="text-4xl transition-transform group-hover:scale-110">{CATEGORY_ICONS[cat]}</span>
              <span className="text-sm font-medium text-foreground">{CATEGORY_LABELS[cat]}</span>
              <span className="text-xs text-muted-foreground">
                {count} {plural(count, "продукт", "продукта", "продуктов")}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
