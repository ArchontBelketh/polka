import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ProductCard } from "@/components/catalog/ProductCard"
import { Upload, ScanLine, UserCheck, TrendingUp, Check, X } from "lucide-react"
import { SellCta } from "./SellCta"

// Соц-доказательства показываем, только когда цифры уже не стыдные —
// порог по числу опубликованных продуктов.
const STATS_THRESHOLD = 15

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

export const metadata: Metadata = {
  title: "Продавайте на ПОЛКЕ — прямая оплата автору",
  description:
    "Разместите готовый бот, парсер или 1С-обработку и продавайте напрямую: покупатель платит вам, площадка оплату за товары не берёт. Размещение бесплатно, плата за продажу 0%.",
  openGraph: {
    title: "Продавайте на ПОЛКЕ — прямая оплата автору",
    description: "Разместите готовый код и продавайте напрямую. Размещение бесплатно, 0% с продаж.",
    url: `${APP_URL}/sell`,
    images: [{ url: `${APP_URL}/og-default.svg`, width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Продавайте на ПОЛКЕ",
    description: "Разместите готовый код и продавайте напрямую. Размещение бесплатно, 0% с продаж.",
    images: [`${APP_URL}/og-default.svg`],
  },
}

const STEPS = [
  { icon: Upload, title: "Загрузка", text: "Заполняете карточку, прикладываете файлы и инструкцию. 15 минут — и черновик готов." },
  { icon: ScanLine, title: "Проверка", text: "Код проходит автоматический X-Ray и ручную модерацию. В карточке появляется блок «Что делает этот код»." },
  { icon: UserCheck, title: "Публикация", text: "Указываете свою ссылку для оплаты в реквизитах — и продукт попадает в каталог." },
  { icon: TrendingUp, title: "Прямая оплата", text: "Покупатель платит вам напрямую по вашей ссылке, вы подтверждаете оплату — открывается скачивание." },
]

const CATEGORIES = [
  { title: "Python", text: "Парсеры, автоматизация, обработка файлов, API, утилиты." },
  { title: "Telegram", text: "Боты, уведомления, интеграции, автоматизация." },
  { title: "1С", text: "Обработки, внешние отчёты, интеграции, HTTP/API-сервисы." },
  { title: "JavaScript / Node.js", text: "Утилиты, CLI, серверные инструменты, автоматизация." },
  { title: "Excel", text: "Обработка таблиц, генераторы отчётов, конвертеры." },
  { title: "Парсинг", text: "Сбор данных, обработка результатов, мониторинг сайтов." },
]

const ALLOWED = [
  "Собственные скрипты, боты, парсеры, 1С-обработки",
  "Готовые решения с понятной инструкцией по установке",
  "Продукты, которые реально запускаются и работают",
]

const FORBIDDEN = [
  "Вредоносный код, скрытые майнеры, бэкдоры",
  "Чужой код без прав на перепродажу",
  "Намеренная обфускация, чтобы скрыть поведение",
]

const FAQ = [
  {
    q: "Как я получаю оплату?",
    a: "Покупатель платит вам напрямую по вашей ссылке (ЮKassa, Robokassa, банк). ПОЛКА оплату за товары не принимает. После оплаты покупатель нажимает «Я оплатил», вы подтверждаете получение в кабинете — и покупателю открывается скачивание.",
  },
  {
    q: "Сколько берёт площадка?",
    a: "Размещение бесплатное, плата за продажу сейчас 0%. Деньги за товар — ваши целиком. Как подключить приём оплаты — на странице «Как принимать оплату».",
  },
  {
    q: "Нужен ли мне статус (самозанятый / ИП / ООО), чтобы начать?",
    a: "Загрузить и подготовить продукт можно без статуса. Для публикации нужны правовой статус, реквизиты и ссылка для оплаты — укажите их в разделе «Реквизиты». Чек покупателю и налоги — на вашей стороне.",
  },
  {
    q: "Что такое X-Ray-паспорт?",
    a: "При публикации код проходит X-Ray, и в карточке показывается «Что делает этот код» (интернет, файлы, команды, уязвимые зависимости) — без исходного кода. При загрузке вы отмечаете, нужен ли интернет, пишет ли файлы, запускает ли команды; расхождение с анализом отправляет продукт на ручную проверку.",
  },
  {
    q: "Возвраты и претензии?",
    a: "Вы — продавец, поэтому чек покупателю, возвраты и ответы на претензии на вашей стороне. ПОЛКА помогает в спорах и снимает небезопасные или чужие продукты с продажи.",
  },
]

export default async function SellPage() {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role

  // Честная статистика площадки (только реальные данные из БД).
  const [developerRows, productsCount, salesCount, topProducts] = await Promise.all([
    db.product.findMany({ where: { status: "APPROVED" }, select: { authorId: true }, distinct: ["authorId"] }),
    db.product.count({ where: { status: "APPROVED" } }),
    db.purchase.count({ where: { status: { in: ["PAID", "DELIVERED"] } } }),
    db.product.findMany({
      where: { status: "APPROVED", salesCount: { gt: 0 } },
      orderBy: { salesCount: "desc" },
      take: 3,
      select: {
        id: true, slug: true, title: true, shortDesc: true, category: true, price: true,
        rating: true, reviewCount: true, salesCount: true, screenshots: true,
        techStack: true, manuallyVerified: true,
      },
    }),
  ])

  const showStats = productsCount >= STATS_THRESHOLD
  const statItems = [
    { label: "разработчиков разместили продукты", value: developerRows.length },
    { label: "продуктов в каталоге", value: productsCount },
    { label: "продаж совершено", value: salesCount },
  ].filter((s) => s.value > 0)

  return (
    <div className="space-y-4">
      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center space-y-6">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Ваш код уже написан.{" "}
            <span className="text-primary">Превратите его в доход</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Бот, парсер, Python-скрипт или 1С-обработка, которую вы делали под задачу, может
            продаваться снова и снова. Разместите её один раз — покупатель платит вам напрямую, а
            доступ открывается после вашего подтверждения оплаты. Размещение бесплатно, 0% с продаж.
          </p>
          <div className="flex items-center justify-center gap-3">
            <SellCta role={role} />
          </div>
          <p className="text-sm text-muted-foreground">
            Регистрация и размещение бесплатны.
          </p>
        </div>
      </section>

      {/* Статистика площадки — только выше порога и только реальные цифры */}
      {showStats && statItems.length > 0 && (
        <section className="border-y border-border bg-card/40">
          <div className="mx-auto max-w-5xl px-4 py-12">
            <h2 className="text-center text-2xl font-bold text-foreground">ПОЛКА в цифрах</h2>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3 text-center">
              {statItems.map((s) => (
                <div key={s.label}>
                  <p className="text-3xl font-bold text-primary">{s.value.toLocaleString("ru-RU")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Что можно разместить */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-center text-2xl font-bold text-foreground">Что можно разместить</h2>
        <p className="mt-2 text-center text-muted-foreground">
          Не обязательно создавать новый продукт специально для ПОЛКИ — продавайте то, что уже написали.
        </p>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => (
            <div key={c.title} className="rounded-lg border border-border bg-card p-5 space-y-1.5">
              <h3 className="font-semibold text-foreground">{c.title}</h3>
              <p className="text-sm text-muted-foreground">{c.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Уже продаётся — реальные продукты с продажами (§13) */}
      {topProducts.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 py-12">
          <h2 className="text-center text-2xl font-bold text-foreground">Уже продаётся на ПОЛКЕ</h2>
          <p className="mt-2 text-center text-muted-foreground">
            Реальные продукты, которые покупают прямо сейчас.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {topProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Pricing — прямая оплата, 0% */}
      <section className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-xl border border-border bg-card p-6 text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Размещение бесплатное, 0% с продаж</h2>
          <p className="text-muted-foreground">
            Покупатель платит вам напрямую — деньги за товар ваши целиком. Как подключить приём
            оплаты — <a href="/how-to-get-paid" className="text-primary hover:underline">читайте здесь</a>.
          </p>
        </div>
      </section>

      {/* How it goes */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-center text-2xl font-bold text-foreground">Как проходит публикация</h2>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-4">
            {STEPS.map((step, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className="text-2xl font-bold text-muted-foreground/20">{i + 1}</span>
                </div>
                <h3 className="font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rules */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold text-foreground">Что можно и что нельзя</h2>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-6 space-y-3">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              <Check className="h-5 w-5 text-green-400" />
              Принимаем
            </h3>
            <ul className="space-y-2">
              {ALLOWED.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6 space-y-3">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              <X className="h-5 w-5 text-red-400" />
              Сразу бан
            </h3>
            <ul className="space-y-2">
              {FORBIDDEN.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <X className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-center text-2xl font-bold text-foreground">Частые вопросы</h2>
          <div className="mt-10 space-y-3">
            {FAQ.map((item, i) => (
              <details key={i} className="group rounded-lg border border-border bg-card p-4">
                <summary className="cursor-pointer list-none font-medium text-foreground marker:hidden flex items-center justify-between">
                  {item.q}
                  <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center space-y-6">
        <h2 className="text-3xl font-bold text-foreground">Готовы выложить первый продукт?</h2>
        <p className="text-muted-foreground">
          Загрузка занимает 15 минут. Покупатель платит вам напрямую, вы подтверждаете оплату.
        </p>
        <div className="flex items-center justify-center">
          <SellCta role={role} />
        </div>
      </section>
    </div>
  )
}
