import Link from "next/link"
import { Kicker, ArrowRight } from "./SectionHead"

export function DeveloperCTA() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-24">
      <div className="relative overflow-hidden rounded-3xl border border-[#2A2547] bg-[radial-gradient(120%_170%_at_12%_-10%,#1C1838_0%,#100E1C_58%)] px-8 py-16 text-center sm:px-14">
        {/* декоративные трассы в углу */}
        <svg width="440" height="220" viewBox="0 0 440 220" fill="none" className="pointer-events-none absolute -right-3 -top-2 opacity-40">
          <path d="M440 42 H312 L290 64 H188 M312 42 V14 M188 64 L166 86 H64" stroke="#34E6E0" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M440 124 H352 L330 102 H236" stroke="#9D8CFF" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M440 172 H300 L284 156" stroke="#6C4BF5" strokeWidth="1.5" strokeLinecap="round" />
        </svg>

        <div className="relative">
          <Kicker>{"// для разработчиков"}</Kicker>
          <h2 className="mx-auto mt-4 max-w-2xl text-balance font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Зарабатывайте на своих скриптах
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            Уже есть бот, парсер или 1С-обработка, которую вы писали для себя? Выложите её на ПОЛКУ — и она будет
            продаваться сама. Загрузка занимает 15 минут, площадка берёт на себя оплату, доставку и возвраты.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <Link href="/sell" className="inline-flex items-center gap-2 rounded-xl bg-deep px-6 py-3 font-semibold text-white transition-colors hover:bg-violet">
              Как продавать
              <ArrowRight />
            </Link>
            <Link href="/submit" className="rounded-xl border border-border px-6 py-3 font-semibold text-foreground transition-colors hover:border-cyan hover:text-white">
              Загрузить продукт
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
