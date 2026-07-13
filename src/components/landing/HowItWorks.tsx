import type { ReactNode } from "react"
import { Search, CreditCard, Download } from "lucide-react"
import { SectionHead } from "./SectionHead"

const STEPS: { n: string; tint: "cyan" | "violet"; title: string; desc: string; icon: ReactNode }[] = [
  {
    n: "1",
    tint: "violet",
    title: "Выбрали продукт",
    desc: "В карточке видно, что входит в покупку, системные требования и отзывы. До оплаты можно задать вопрос автору.",
    icon: <Search className="h-5 w-5" />,
  },
  {
    n: "2",
    tint: "cyan",
    title: "Оплатили",
    desc: "Оплата картой через защищённую форму ЮKassa — данные карты остаются у платёжной системы.",
    icon: <CreditCard className="h-5 w-5" />,
  },
  {
    n: "3",
    tint: "violet",
    title: "Скачали и запустили",
    desc: "Файлы и инструкция доступны сразу после оплаты. Что-то не запустилось — пишете разработчику в чат.",
    icon: <Download className="h-5 w-5" />,
  },
]

const BOX = {
  cyan: "bg-cyan/[0.08] border-cyan/20 text-cyan",
  violet: "bg-violet/10 border-violet/[0.22] text-violet",
} as const

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-24">
      <SectionHead kicker="// процесс" title="Как это работает" sub="Три шага от выбора до запуска" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.n} className="relative overflow-hidden rounded-2xl border border-border bg-card p-7">
            <span className="absolute right-6 top-4 font-display text-6xl font-extrabold leading-none text-accent">{s.n}</span>
            <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl border ${BOX[s.tint]}`}>{s.icon}</div>
            <h3 className="mb-2.5 text-lg font-bold text-foreground">{s.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
