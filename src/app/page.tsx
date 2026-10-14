import type { Metadata } from "next"
import Link from "next/link"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { ProductCard } from "@/components/catalog/ProductCard"
import { RefreshCw, FileCheck, KeyRound, ScanLine, ArrowRight } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { SERVICE_KINDS, SERVICE_LABELS, SERVICE_TAGLINES, SERVICE_PRICES, SLUG_BY_KIND } from "@/lib/services"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

export const revalidate = 300

export const metadata: Metadata = {
  title: { absolute: "CYBERПОЛКА — боты, интеграции и автоматизация для бизнеса" },
  description:
    "Опишите задачу — подберём проверенного исполнителя. Код остаётся у вас, доступы под контролем, пропал исполнитель — найдём замену. Бесплатная проверка кода X-Ray.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "CYBERПОЛКА — проект, который не пропадёт вместе с разработчиком",
    description:
      "Боты, интеграции и автоматизация для малого бизнеса. Подбор исполнителя бесплатный, код остаётся у вас. Бесплатная проверка кода X-Ray.",
    url: APP_URL,
    images: [{ url: `${APP_URL}/og-default.svg`, width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CYBERПОЛКА — проект, который не пропадёт вместе с разработчиком",
    description: "Боты, интеграции и автоматизация для бизнеса. Подбор исполнителя бесплатный.",
    images: [`${APP_URL}/og-default.svg`],
  },
}

const PRODUCT_CARD_SELECT = {
  id: true, slug: true, title: true, shortDesc: true, category: true, price: true,
  rating: true, reviewCount: true, salesCount: true, screenshots: true,
  techStack: true, manuallyVerified: true,
} as const

const STEPS = [
  "Опишите задачу своими словами — мы уточним её за 24 часа.",
  "Выберите исполнителя из 1–3 разработчиков, которых мы отобрали.",
  "Примите работу по отчёту X-Ray и критериям, согласованным заранее.",
  "Получите паспорт проекта: код, доступы и инструкция остаются у вас.",
]

const FEATURES = [
  { icon: RefreshCw, title: "«Эстафета»", text: "Пропал исполнитель — подберём замену, и работа продолжится с того же места." },
  { icon: FileCheck, title: "Паспорт проекта", text: "Заказ закрывается, только когда у вас есть код, список доступов и инструкция по запуску." },
  { icon: KeyRound, title: "Доступы под контролем", text: "Пароли не уходят в переписку: доступ выдаётся на время работы, после сдачи поможем всё отозвать." },
  { icon: ScanLine, title: "Рентген приёмки", text: "До приёмки вы видите, что делает сданный код: куда ходит в интернет и нет ли в нём паролей." },
]

const FAQ = [
  { q: "Сколько это стоит?", a: "Подбор исполнителя и базовая проверка кода бесплатны. Работу вы оплачиваете исполнителю напрямую. Платные у нас только собственные услуги: глубокий аудит, проверка работы подрядчика и разбор проекта, если разработчик пропал." },
  { q: "Как купить готовое решение?", a: "Вы платите автору по его ссылке, автор подтверждает оплату, и файл открывается в личном кабинете." },
  { q: "Что, если автор не подтвердил оплату?", a: "Нажмите «Пожаловаться» — мы разберёмся и при нарушении заблокируем автора. Вернуть деньги может только автор: ПОЛКА не принимает оплату за товары." },
  { q: "Кто исполнители?", a: "Разработчики, которых мы отобрали лично: смотрим примеры работ и проверяем их код через X-Ray." },
  { q: "Что, если исполнитель пропадёт?", a: "Включится «Эстафета»: подберём замену, и новый разработчик продолжит с того же места, потому что код лежит в вашем репозитории. Оставшуюся работу вы оплачиваете новому исполнителю." },
  { q: "Кому принадлежит код?", a: "Код лежит в вашем репозитории с первого дня, а права на него передаются по договору с исполнителем — шаблон договора мы дадим." },
  { q: "Код написала нейросеть — вы поможете?", a: "Да. Загрузите его в бесплатную проверку X-Ray или оставьте заявку на доработку." },
]

const XRAY_SAMPLE = `Что делает этот код · Python

Интернет   api.telegram.org, 45.12.xx.xx (голый IP)
Файлы      пишет в ./data
Команды    не запускает
Секреты    токен бота в коде (7314…aF9k)
Зависимости requests 2.19 — уязвимость`

export default async function Home() {
  const featured = await db.product.findMany({
    where: { status: "APPROVED", salesCount: { gt: 0 } },
    orderBy: [{ manuallyVerified: "desc" }, { salesCount: "desc" }],
    take: 3,
    select: PRODUCT_CARD_SELECT,
  })

  return (
    <div className="space-y-4">
      {/* Первый экран */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-20 lg:grid-cols-2">
          <div className="space-y-6">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Проект, который не пропадёт вместе с разработчиком
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Боты, интеграции и автоматизация для малого бизнеса. Код лежит у вас, доступы под вашим
              контролем, а если исполнитель исчезнет — поможем найти замену.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/request" className="flex items-center gap-2">
                  Описать задачу <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/x-ray">Проверить код бесплатно</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Подбор исполнителя бесплатный. Ответим за 24 часа.</p>
          </div>

          {/* Реальный фрагмент отчёта X-Ray — чем ПОЛКА отличается */}
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">Пример проверки кода</p>
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
              {XRAY_SAMPLE}
            </pre>
            <Link href="/x-ray" className="mt-3 inline-block text-sm text-primary hover:underline">
              Проверить свой код →
            </Link>
          </div>
        </div>
      </section>

      {/* Как это работает */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold text-foreground">Как это работает</h2>
        <ol className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-4">
          {STEPS.map((text, i) => (
            <li key={i} className="space-y-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-bold text-primary">
                {i + 1}
              </span>
              <p className="text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Чем ПОЛКА отличается */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-center text-2xl font-bold text-foreground">Чем ПОЛКА отличается</h2>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-4">
                <f.icon className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                <div>
                  <h3 className="font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-9 text-center text-sm text-muted-foreground">
            ПОЛКА не берёт деньги за чужую работу и товары: вы платите исполнителю или автору напрямую.
          </p>
        </div>
      </section>

      {/* Готовые решения */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold text-foreground">Готовые решения</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
          Возможно, ваша задача уже решена. Сначала покажем готовые решения с полки: это дешевле и
          быстрее, чем заказ с нуля. Оплата — напрямую автору.
        </p>
        {featured.length > 0 && (
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
        <div className="mt-8 text-center">
          <Button asChild size="lg" variant="outline">
            <Link href="/catalog">Смотреть каталог</Link>
          </Button>
        </div>
      </section>

      {/* Платные услуги */}
      <section className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-center text-2xl font-bold text-foreground">Платные услуги</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
            Когда нужна не просто проверка, а разбор и помощь: аудит кода, приёмка работы подрядчика
            или спасение проекта, если разработчик пропал.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {SERVICE_KINDS.map((kind) => (
              <Link
                key={kind}
                href={`/services/order?kind=${SLUG_BY_KIND[kind]}`}
                className="flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
              >
                <h3 className="font-semibold text-foreground">{SERVICE_LABELS[kind]}</h3>
                <p className="mt-1 text-lg font-bold text-primary">{formatPrice(SERVICE_PRICES[kind])}</p>
                <p className="mt-2 text-sm text-muted-foreground">{SERVICE_TAGLINES[kind]}</p>
              </Link>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button asChild size="lg" variant="outline">
              <Link href="/services">Подробнее об услугах</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Вопросы и ответы */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-center text-2xl font-bold text-foreground">Вопросы и ответы</h2>
          <div className="mt-10 space-y-3">
            {FAQ.map((item, i) => (
              <details key={i} className="group rounded-lg border border-border bg-card p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-foreground marker:hidden">
                  {item.q}
                  <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Финальный призыв */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center space-y-6">
        <h2 className="text-3xl font-bold text-foreground">Опишите задачу — ответим за 24 часа</h2>
        <div className="flex items-center justify-center">
          <Button asChild size="lg">
            <Link href="/request" className="flex items-center gap-2">
              Описать задачу <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Есть готовый код? <Link href="/sell" className="text-primary hover:underline">Продавайте его на ПОЛКЕ</Link>.
        </p>
      </section>

      {/* Мелкий шрифт */}
      <section className="mx-auto max-w-5xl px-4 pb-12">
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>X-Ray — автоматический анализ кода, а не гарантия безопасности.</li>
          <li>Условия «Эстафеты» — в правилах сервиса.</li>
          <li>ПОЛКА — информационный сервис и не является стороной сделок между покупателями и авторами, заказчиками и исполнителями.</li>
        </ul>
      </section>
    </div>
  )
}
