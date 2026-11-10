import Link from "next/link"
import { Suspense } from "react"
import { ArrowRight, ArrowUpRight, Blocks, Braces, Check, Code2, FileText, Layers3, MessageSquareText, Package, Workflow } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FeaturedProducts } from "./FeaturedProducts"

const CATEGORIES = [
  { title: "Telegram-боты", href: "/catalog?category=TELEGRAM" },
  { title: "1С и интеграции", href: "/catalog?q=1%D0%A1" },
  { title: "Автоматизация", href: "/catalog?category=AUTOMATION" },
  { title: "Таблицы и отчёты", href: "/catalog?category=EXCEL" },
  { title: "Парсеры", href: "/catalog?category=PARSER" },
] as const

const FAQ = [
  { question: "Что выбрать: готовый код или разработку?", answer: "Начните с каталога, если ищете типовую функцию: бот, обработку данных или интеграцию. Если нужен другой результат или доработка под вашу систему, опишите задачу в форме заявки." },
  { question: "Как сейчас принимаются задачи на разработку?", answer: "Создайте черновик заказа: опишите задачу, ожидаемый результат, бюджет и срок. После модерации заказ появится в каталоге. Выберите предложение исполнителя и продолжите работу в приватной рабочей области." },
  { question: "Как проходит покупка готового кода?", answer: "Изучите описание, требования и лицензию товара. В текущем сценарии покупатель оплачивает продукт автору напрямую, а после подтверждения оплаты получает доступ к скачиванию в разделе «Мои покупки»." },
  { question: "Могу ли я и покупать код, и продавать свой?", answer: "Да. Используйте один аккаунт. Чтобы публиковать свои продукты, включите режим разработчика, заполните реквизиты и подготовьте карточку с файлами и инструкцией." },
  { question: "Какая проверка есть у готового кода?", answer: "Перед публикацией файлы проходят базовые проверки и модерацию. Они не заменяют оценку совместимости с вашей системой: изучите требования, документацию и задайте вопросы автору." },
]

function Paths() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:ml-auto lg:mr-0">
      <div aria-hidden="true" className="pointer-events-none absolute -inset-10 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(108,75,245,0.13),transparent_65%)]" />
      <div className="relative overflow-hidden rounded-2xl border border-violet/25 bg-card shadow-[0_24px_100px_-40px_rgba(108,75,245,0.5)]">
        <div className="flex items-center justify-between border-b border-border bg-background/60 px-5 py-4 sm:px-6">
          <span className="font-mono text-xs tracking-wider text-muted-foreground">ВАША ЗАДАЧА → РЕШЕНИЕ</span>
          <span aria-hidden="true" className="flex gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-cyan" /><span className="h-1.5 w-1.5 rounded-full bg-violet" /><span className="h-1.5 w-1.5 rounded-full bg-deep" /></span>
        </div>
        <div className="space-y-3 p-4 sm:p-6">
          <Link href="/catalog" className="group flex gap-4 rounded-xl border border-violet/25 bg-violet/5 p-5 transition-colors hover:border-violet/60 hover:bg-violet/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet/25 bg-violet/10 text-violet"><Package className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="mb-1 block font-mono text-[11px] text-violet">01 / ГОТОВЫЙ КОД</span><span className="block text-lg font-semibold">Найти готовое решение</span><span className="mt-1.5 block text-sm leading-relaxed text-muted-foreground">Сравните продукты, проверьте требования и выберите подходящий.</span></span>
            <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-violet transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
          <div aria-hidden="true" className="flex items-center gap-3 px-5"><span className="h-px flex-1 bg-border" /><span className="font-mono text-[10px] tracking-widest text-muted-foreground">ИЛИ</span><span className="h-px flex-1 bg-border" /></div>
          <Link href="/orders/new" className="group flex gap-4 rounded-xl border border-cyan/25 bg-cyan/5 p-5 transition-colors hover:border-cyan/60 hover:bg-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan/25 bg-cyan/10 text-cyan"><Workflow className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="mb-1 block font-mono text-[11px] text-cyan">02 / РАЗРАБОТКА</span><span className="block text-lg font-semibold">Создать под свою задачу</span><span className="mt-1.5 block text-sm leading-relaxed text-muted-foreground">Расскажите, что нужно автоматизировать и какой результат вы ждёте.</span></span>
            <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-cyan transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
        <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground sm:px-6">Пишете код? <Link href="/sell" className="font-medium text-violet underline-offset-4 hover:underline">Разместите свой продукт <span aria-hidden="true">↗</span></Link></p>
      </div>
    </div>
  )
}

function FeaturedLoading() {
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="status"><span className="sr-only">Загружаем готовые решения</span>{[0, 1, 2].map((index) => <div key={index} aria-hidden="true" className="h-64 rounded-2xl border border-border bg-card motion-safe:animate-pulse" />)}</div>
}

export default function HomeLanding() {
  return (
    <div className="overflow-clip">
      <section className="relative border-b border-border">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_8%_15%,rgba(52,230,224,0.035),transparent_55%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:py-24">
          <div>
            <p className="mb-6 flex items-center gap-2.5 font-mono text-[11px] tracking-[0.13em] text-violet sm:text-xs"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-cyan" />КОД И РАЗРАБОТКА ДЛЯ ВАШЕГО ДЕЛА</p>
            <h1 className="font-display text-[clamp(2.3rem,4.5vw,4rem)] font-bold leading-[1.16] tracking-tight"><span className="text-cyan">Готовый код.</span><br />Разработка под<br className="hidden sm:block" /> вашу задачу.</h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-secondary-foreground sm:text-lg">Боты, интеграции и автоматизация. Найдите подходящий продукт или расскажите, что нужно разработать.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg"><Link href="/catalog">Найти готовый код<ArrowRight aria-hidden="true" /></Link></Button>
              <Button asChild size="lg" variant="cyan"><Link href="/orders/new">Описать задачу<ArrowUpRight aria-hidden="true" /></Link></Button>
            </div>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">Один аккаунт, чтобы покупать решения, заказывать разработку и продавать свой код.</p>
          </div>
          <Paths />
        </div>
        <div className="relative border-t border-border bg-background/60">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-5 sm:px-6">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">На полке</span>
            {CATEGORIES.map((category) => <Link key={category.href} href={category.href} className="rounded-sm text-sm text-secondary-foreground underline-offset-4 transition-colors hover:text-cyan hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan">{category.title}</Link>)}
          </div>
        </div>
      </section>

      <section aria-labelledby="directions-title" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="font-mono text-xs tracking-widest text-violet">ДВА ПУТИ К РЕЗУЛЬТАТУ</p>
        <h2 id="directions-title" className="mt-3 font-display text-2xl font-semibold sm:text-3xl">Начните с того, что вам нужно</h2>
        <div className="mt-9 grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="border-t-2 border-violet/60 pt-6">
            <div className="flex items-center gap-3 text-violet"><Blocks aria-hidden="true" className="h-5 w-5" /><span className="font-mono text-xs tracking-wider">ГОТОВЫЙ КОД</span></div>
            <h3 className="mt-4 text-xl font-semibold">Не начинайте с нуля, если решение уже есть</h3>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">Для типовой задачи подойдёт готовый бот, скрипт или модуль. В карточке продукта изучите возможности и ограничения, затем задайте вопросы автору.</p>
            <ul className="mt-5 space-y-3 text-sm text-secondary-foreground">{["Возможности, требования и примеры", "Условия лицензии, поддержки и обновлений", "Доступ к файлам после подтверждения оплаты"].map((text) => <li key={text} className="flex items-start gap-2.5"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-violet" />{text}</li>)}</ul>
            <Link href="/catalog" className="mt-6 inline-flex items-center gap-2 rounded-sm text-sm font-semibold text-violet underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">Посмотреть готовые решения<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
          </div>
          <div className="border-t-2 border-cyan/60 pt-6">
            <div className="flex items-center gap-3 text-cyan"><Braces aria-hidden="true" className="h-5 w-5" /><span className="font-mono text-xs tracking-wider">РАЗРАБОТКА НА ЗАКАЗ</span></div>
            <h3 className="mt-4 text-xl font-semibold">Нужен другой результат? Опишите задачу</h3>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">Опубликуйте задачу после модерации, сравните бесплатные отклики и выберите исполнителя. Условия, переписка и приёмка сохраняются в рабочей области заказа.</p>
            <ul className="mt-5 space-y-3 text-sm text-secondary-foreground">{["Что должно получиться в результате", "С какими сервисами и данными нужно работать", "Какой бюджет и срок вы рассматриваете"].map((text) => <li key={text} className="flex items-start gap-2.5"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />{text}</li>)}</ul>
            <Link href="/orders/new" className="mt-6 inline-flex items-center gap-2 rounded-sm text-sm font-semibold text-cyan underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan">Перейти к форме задачи<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="ready-code-title" className="border-y border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="font-mono text-xs tracking-widest text-violet">МАГАЗИН КОДА</p><h2 id="ready-code-title" className="mt-3 font-display text-2xl font-semibold sm:text-3xl">Готовые решения на полке</h2><p className="mt-3 text-sm text-muted-foreground">Изучите описание и требования. Выберите то, что подходит вашей задаче.</p></div>
            <Button asChild variant="outline"><Link href="/catalog">Весь каталог<ArrowRight aria-hidden="true" /></Link></Button>
          </div>
          <Suspense fallback={<FeaturedLoading />}><FeaturedProducts /></Suspense>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid items-center gap-8 rounded-2xl border border-border bg-[linear-gradient(120deg,rgba(108,75,245,0.10),rgba(52,230,224,0.025))] p-6 sm:p-10 lg:grid-cols-[1.4fr_1fr]">
          <div><p className="font-mono text-xs tracking-widest text-violet">РАЗРАБОТЧИКАМ</p><h2 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">Ваш код может решить ещё чью-то задачу</h2><p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">Упакуйте собственное решение в продукт: добавьте описание, требования, инструкцию и условия использования. Покупатель сможет понять, подходит ли ему ваш код.</p></div>
          <div className="space-y-5 lg:justify-self-end"><div className="flex items-center gap-3 text-sm text-secondary-foreground"><Code2 aria-hidden="true" className="h-5 w-5 text-violet" />Собственный код</div><div className="flex items-center gap-3 text-sm text-secondary-foreground"><FileText aria-hidden="true" className="h-5 w-5 text-violet" />Понятная документация</div><div className="flex items-center gap-3 text-sm text-secondary-foreground"><Layers3 aria-hidden="true" className="h-5 w-5 text-violet" />Версии и обновления</div><Button asChild><Link href="/sell">Разместить код<ArrowUpRight aria-hidden="true" /></Link></Button></div>
        </div>
      </section>

      <section aria-labelledby="faq-title" className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 sm:pb-20">
        <h2 id="faq-title" className="font-display text-2xl font-semibold sm:text-3xl">Перед тем как начать</h2>
        <div className="mt-7 divide-y divide-border border-y border-border">{FAQ.map((item) => <details key={item.question} className="group py-5"><summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-sm font-medium marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">{item.question}<span aria-hidden="true" className="text-xl leading-6 text-violet transition-transform group-open:rotate-45">+</span></summary><p className="mt-3 pr-8 text-sm leading-relaxed text-muted-foreground">{item.answer}</p></details>)}</div>
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><MessageSquareText aria-hidden="true" className="h-4 w-4 shrink-0 text-violet" />Есть вопрос? <Link href="/support" className="text-violet underline-offset-4 hover:underline">Напишите в поддержку</Link></p>
      </section>
    </div>
  )
}
