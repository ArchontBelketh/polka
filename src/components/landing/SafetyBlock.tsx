import type { ReactNode } from "react"
import Link from "next/link"
import { ScanLine, UserCheck, ShieldAlert, Sparkles } from "lucide-react"
import { SectionHead } from "./SectionHead"

const ITEMS: { tint: "cyan" | "violet"; title: string; desc: string; icon: ReactNode }[] = [
  {
    tint: "cyan",
    title: "Автоматическое сканирование",
    desc: "Код проходит статический анализ (Bandit, Semgrep, проверка по VirusTotal) и поиск опасных паттернов до того, как попадёт в каталог.",
    icon: <ScanLine className="h-5 w-5" />,
  },
  {
    tint: "violet",
    title: "Ручная модерация",
    desc: "Подозрительные продукты уходят модератору. Никакой обфускации, скрытых сетевых вызовов и чужого кода — это правила площадки.",
    icon: <UserCheck className="h-5 w-5" />,
  },
  {
    tint: "cyan",
    title: "Снимаем небезопасное",
    desc: "Если проблема всплывает уже после публикации, продукт сразу снимается с площадки, а покупатели получают предупреждение с рекомендациями.",
    icon: <ShieldAlert className="h-5 w-5" />,
  },
  {
    tint: "violet",
    title: "AI-аудит по запросу",
    desc: "Перед покупкой можно заказать независимый разбор кода нейросетью за 390 ₽ — она ищет уязвимости и несоответствия описанию.",
    icon: <Sparkles className="h-5 w-5" />,
  },
]

const BOX = {
  cyan: "bg-cyan/[0.08] border-cyan/20 text-cyan",
  violet: "bg-violet/10 border-violet/[0.22] text-violet",
} as const

export function SafetyBlock() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-24">
      <SectionHead
        kicker="// безопасность"
        title="Почему на ПОЛКЕ безопасно"
        sub="Маркетплейс чужого кода — это риск нарваться на вредонос. Мы закрыли его системно, на каждом шаге."
        wide
      />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {ITEMS.map((it) => (
          <div key={it.title} className="flex items-start gap-5 rounded-2xl border border-border bg-card p-6 transition-colors hover:border-deep/40">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${BOX[it.tint]}`}>{it.icon}</div>
            <div>
              <h3 className="mb-2 text-[17px] font-bold text-foreground">{it.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{it.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-9 text-center text-sm text-muted-foreground">
        Подробнее о проверке —{" "}
        <Link href="/catalog" className="text-violet transition-colors hover:text-violet/80">
          смотрите каталог
        </Link>
      </div>
    </section>
  )
}
