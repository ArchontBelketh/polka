import type { ReactNode } from "react"
import Link from "next/link"
import { Bot, Search, Table2, Workflow, Globe } from "lucide-react"
import { CATEGORY_LABELS, type Category } from "@/types"
import { SectionHead } from "./SectionHead"

const ORDER: Category[] = ["TELEGRAM", "PARSER", "EXCEL", "AUTOMATION", "WEB"]

const META: Record<Category, { tint: "cyan" | "violet"; icon: ReactNode }> = {
  TELEGRAM: { tint: "violet", icon: <Bot className="h-6 w-6" /> },
  PARSER: { tint: "cyan", icon: <Search className="h-6 w-6" /> },
  EXCEL: { tint: "violet", icon: <Table2 className="h-6 w-6" /> },
  AUTOMATION: { tint: "cyan", icon: <Workflow className="h-6 w-6" /> },
  WEB: { tint: "violet", icon: <Globe className="h-6 w-6" /> },
}

const BOX = {
  cyan: "bg-cyan/[0.08] border-cyan/20 text-cyan",
  violet: "bg-violet/10 border-violet/[0.22] text-violet",
} as const

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
    <section className="mx-auto max-w-6xl px-4 pt-24">
      <SectionHead kicker="// каталог" title="Категории" sub="Найдите готовое решение под свою задачу" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {ORDER.map((cat) => {
          const count = counts[cat] ?? 0
          const m = META[cat]
          return (
            <Link
              key={cat}
              href={`/catalog?category=${cat}`}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-7 text-center transition-all duration-200 hover:-translate-y-1 hover:border-deep/40 hover:bg-accent/40"
            >
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${BOX[m.tint]}`}>{m.icon}</div>
              <span className="text-[15px] font-bold text-foreground">{CATEGORY_LABELS[cat]}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {count > 0 ? `${count} ${plural(count, "продукт", "продукта", "продуктов")}` : "скоро"}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
