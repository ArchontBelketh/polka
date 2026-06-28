import Link from "next/link"
import { Search, ShieldCheck } from "lucide-react"
import { ArrowRight } from "./SectionHead"

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* ambient glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[1000px] -translate-x-1/2 rounded-full bg-deep/20 blur-3xl" />
      <div className="pointer-events-none absolute right-[8%] top-10 h-[360px] w-[420px] rounded-full bg-cyan/10 blur-3xl" />

      <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-20 text-center">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan/25 bg-cyan/[0.07] px-4 py-1.5 font-mono text-xs text-cyan">
          <ShieldCheck className="h-3.5 w-3.5" />
          Каждый продукт проверяется перед публикацией
        </div>

        <h1 className="mx-auto max-w-3xl text-balance font-display text-4xl font-extrabold leading-[1.07] tracking-tight text-foreground sm:text-5xl">
          Готовые программы для бизнеса — <span className="text-violet">с проверкой кода</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
          Telegram-боты, парсеры, Excel- и 1С-скрипты, автоматизация. Код каждого продукта проходит
          автосканирование и ручную модерацию. Деньги — под защитой эскроу на 7 дней.
        </p>

        {/* поиск → каталог */}
        <form action="/catalog" className="mx-auto mt-9 flex max-w-xl items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              placeholder="Что вам нужно? Например: бот записи клиентов"
              className="h-14 w-full rounded-xl border border-border bg-card pl-11 pr-4 text-foreground outline-none placeholder:text-muted-foreground focus:border-deep"
            />
          </div>
          <button type="submit" className="h-14 shrink-0 rounded-xl bg-deep px-7 font-semibold text-white transition-colors hover:bg-violet">
            Найти
          </button>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3.5">
          <Link href="/catalog" className="inline-flex items-center gap-2 rounded-xl bg-deep px-6 py-3 font-semibold text-white transition-colors hover:bg-violet">
            Смотреть каталог
            <ArrowRight />
          </Link>
          <Link href="/sell" className="rounded-xl border border-border px-6 py-3 font-semibold text-foreground transition-colors hover:border-deep hover:text-white">
            Продавать на ПОЛКЕ
          </Link>
        </div>
      </div>
    </section>
  )
}
