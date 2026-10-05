import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { IncomeCalculator } from "@/components/landing/IncomeCalculator"
import { ProductCard } from "@/components/catalog/ProductCard"
import { formatPrice } from "@/lib/utils"
import { Upload, ScanLine, UserCheck, TrendingUp, Check, X, Zap } from "lucide-react"
import { SellCta } from "./SellCta"
import {
  getEarlySellerStats,
  EARLY_SELLER_SLOTS,
  EARLY_SELLER_PRO_MONTHS,
  EARLY_SELLER_BADGE,
} from "@/lib/early-seller"

// Соц-доказательства показываем, только когда цифры уже не стыдные —
// порог по числу опубликованных продуктов.
const STATS_THRESHOLD = 15

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

export const metadata: Metadata = {
  title: "Продавать на ПОЛКЕ — заработок на готовых скриптах",
  description:
    "Выложите свой бот, парсер или 1С-обработку и получайте до 80% с продажи. Площадка берёт на себя оплату и доставку файлов. Загрузка за 15 минут.",
  openGraph: {
    title: "Продавать на ПОЛКЕ — заработок на готовых скриптах",
    description: "Выложите готовый продукт и получайте до 80% с каждой продажи.",
    url: `${APP_URL}/sell`,
    images: [{ url: `${APP_URL}/og-default.svg`, width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Продавать на ПОЛКЕ",
    description: "Выложите готовый продукт и получайте до 80% с каждой продажи.",
    images: [`${APP_URL}/og-default.svg`],
  },
}

const STEPS = [
  { icon: Upload, title: "Загрузка", text: "Заполняете карточку, прикладываете файлы и инструкцию по установке. 15 минут — и черновик готов." },
  { icon: ScanLine, title: "Автоскан", text: "Код автоматически сканируется на вредоносные паттерны за пару минут. Чистые продукты идут дальше." },
  { icon: UserCheck, title: "Модерация", text: "Модератор проверяет продукт за 24–48 часов: соответствие описанию, отсутствие чужого кода." },
  { icon: TrendingUp, title: "Продажи", text: "Продукт в каталоге. Оплата и доставка файлов — на площадке. Деньги зачисляются на баланс сразу после оплаты." },
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
    q: "Как продаётся продукт — через площадку или напрямую?",
    a: "Зависит от цены. Дешевле ценового порога (15 000 ₽) — продажа идёт через площадку: покупатель платит нам, мы перечисляем вам сумму за вычетом комиссии. От порога — прямая продажа: покупатель платит вам напрямую по вашим реквизитам, а площадка берёт разовый тариф за размещение. Точные цифры — в Приложении №1.",
  },
  {
    q: "Когда я получу деньги? (продажа через площадку)",
    a: "Сумма за вычетом комиссии зачисляется на ваш баланс после оплаты покупателем. По крупным продажам (от порога удержания) зачисление придерживается до конца окна претензии — чтобы обеспечить возможный возврат. Вывод обрабатывается администратором по вторникам и пятницам.",
  },
  {
    q: "Что такое тариф за размещение?",
    a: "Для дорогих продуктов (от 15 000 ₽) площадка не участвует в расчётах — вы получаете оплату напрямую. За право размещать и продавать такой продукт взимается разовый тариф (процент от цены), после оплаты которого продаж может быть сколько угодно. Получение оплаты вы подтверждаете в кабинете, после чего покупателю открывается скачивание.",
  },
  {
    q: "Чем Pro лучше бесплатного тарифа?",
    a: "На Pro комиссия площадки по продажам «через площадку» снижается с 20% до 17% и доступно больше слотов. Подписка окупается при регулярных продажах.",
  },
  {
    q: "Бывают ли возвраты?",
    a: "По продажам через площадку покупатель может подать претензию в течение 7 дней, если продукт не соответствует описанию или не работает; обоснованный возврат исполняется за ваш счёт. По прямым продажам (тариф за размещение) возвраты вы решаете с покупателем напрямую. Небезопасные или чужие продукты снимаются модерацией с продажи.",
  },
  {
    q: "Нужен ли мне статус (самозанятый / ИП / ООО), чтобы начать?",
    a: "Чтобы загрузить продукт, подготовить карточку и сохранить черновик — статус не нужен. Правовой статус и реквизиты нужны только для публикации и получения денег: без них мы просто не сможем перечислить вам выплату. Укажите их в разделе «Реквизиты», когда будете готовы продавать. Чек покупателю и налоги — на вашей стороне.",
  },
]

const PLANS = [
  {
    name: "Бесплатный",
    price: "0 ₽",
    highlight: false,
    features: ["2 слота под продукты", "Комиссия 20%", "Автоскан и модерация", "Мгновенное зачисление выплат"],
  },
  {
    name: "Докупка слотов",
    price: "разово",
    highlight: false,
    features: ["+1 / +5 / +15 слотов", "Комиссия 20%", "Оплата один раз", "Слоты не сгорают"],
  },
  {
    name: "Pro",
    price: "подписка",
    highlight: true,
    features: ["Сниженная комиссия 17%", "Больше слотов", "Приоритет в поддержке", "Окупается при потоке продаж"],
  },
]

export default async function SellPage() {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role

  const earlySeller = await getEarlySellerStats()

  // Честная статистика площадки (только реальные данные из БД).
  const [developerRows, productsCount, salesCount, paidAgg, topProducts] = await Promise.all([
    db.product.findMany({ where: { status: "APPROVED" }, select: { authorId: true }, distinct: ["authorId"] }),
    db.product.count({ where: { status: "APPROVED" } }),
    db.purchase.count({ where: { status: { in: ["PAID", "DELIVERED"] } } }),
    db.payout.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
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
    { label: "разработчиков разместили продукты", value: developerRows.length, money: false },
    { label: "продуктов в каталоге", value: productsCount, money: false },
    { label: "продаж совершено", value: salesCount, money: false },
    { label: "выплачено разработчикам", value: paidAgg._sum.amount ?? 0, money: true },
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
            продаваться снова и снова. Разместите её один раз — оплату и выдачу файлов покупателю
            берёт на себя ПОЛКА. Вы получаете до 80% с каждой продажи.
          </p>
          <div className="flex items-center justify-center gap-3">
            <SellCta role={role} />
          </div>
          <p className="text-sm text-muted-foreground">
            {earlySeller.left > 0
              ? `Первым ${earlySeller.total} продавцам — ${EARLY_SELLER_SLOTS} слотов и Pro бесплатно · осталось ${earlySeller.left} мест`
              : "Регистрация бесплатна · 2 продукта бесплатно · комиссия только после продажи"}
          </p>
        </div>
      </section>

      {/* Программа «первых продавцов» — спец-условия + счётчик свободных мест */}
      <section className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-2xl border border-primary/40 bg-primary/5 ring-1 ring-primary/20 p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-primary">
              <Zap className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Ограниченная программа</span>
            </div>
            {earlySeller.left > 0 ? (
              <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">
                Осталось {earlySeller.left} из {earlySeller.total} мест
              </span>
            ) : (
              <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">
                Все {earlySeller.total} мест заняты
              </span>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              Первые продавцы ПОЛКИ получают больше
            </h2>
            <p className="text-muted-foreground">
              Мы набираем первых {earlySeller.total} разработчиков и даём им усиленные условия.
              Место закрепляется автоматически — просто станьте продавцом, пока есть свободные.
            </p>
          </div>

          {/* Прогресс-бар занятости мест */}
          <div className="space-y-1.5">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, Math.round((earlySeller.taken / earlySeller.total) * 100))}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Занято {earlySeller.taken} из {earlySeller.total}
            </p>
          </div>

          {/* Спец-условия */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4 space-y-1">
              <p className="font-semibold text-foreground">{EARLY_SELLER_SLOTS} слотов бесплатно</p>
              <p className="text-sm text-muted-foreground">Вместо стандартных 2 — выкладывайте сразу больше продуктов.</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 space-y-1">
              <p className="font-semibold text-foreground">Pro на {EARLY_SELLER_PRO_MONTHS} месяца бесплатно</p>
              <p className="text-sm text-muted-foreground">Сниженная комиссия 17% вместо 20% на первые продажи.</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 space-y-1">
              <p className="font-semibold text-foreground">Бейдж «{EARLY_SELLER_BADGE}»</p>
              <p className="text-sm text-muted-foreground">Статус раннего продавца в профиле + приоритетная модерация.</p>
            </div>
          </div>

          {earlySeller.left > 0 ? (
            <div className="flex flex-col items-center gap-2 pt-1">
              <SellCta role={role} />
              <p className="text-xs text-muted-foreground">
                Условия закрепляются при регистрации, пока есть свободные места.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Набор первых продавцов завершён. Зарегистрироваться и продавать по-прежнему можно —
              на стандартных условиях.
            </p>
          )}
        </div>
      </section>

      {/* Статистика площадки — только выше порога и только реальные цифры */}
      {showStats && statItems.length > 0 && (
        <section className="border-y border-border bg-card/40">
          <div className="mx-auto max-w-5xl px-4 py-12">
            <h2 className="text-center text-2xl font-bold text-foreground">ПОЛКА в цифрах</h2>
            <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4 text-center">
              {statItems.map((s) => (
                <div key={s.label}>
                  <p className="text-3xl font-bold text-primary">
                    {s.money ? formatPrice(s.value) : s.value.toLocaleString("ru-RU")}
                  </p>
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

      {/* Calculator */}
      <section className="mx-auto max-w-2xl px-4 py-12">
        <IncomeCalculator />
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-center text-2xl font-bold text-foreground">Условия</h2>
        <p className="mt-2 text-center text-muted-foreground">
          Дешевле 15 000 ₽ — продажа через площадку с комиссией; от 15 000 ₽ — прямая продажа с
          разовым тарифом за размещение. Точные значения — в{" "}
          <a href="/legal/tariffs" className="text-primary hover:underline">Приложении №1</a>.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl border bg-card p-6 space-y-4 ${
                plan.highlight ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
              }`}
            >
              <div>
                <h3 className="font-semibold text-foreground">{plan.name}</h3>
                <p className="text-2xl font-bold text-foreground">{plan.price}</p>
              </div>
              <ul className="space-y-2">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
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
          Загрузка занимает 15 минут. Дальше площадка работает за вас.
        </p>
        <div className="flex items-center justify-center">
          <SellCta role={role} />
        </div>
      </section>
    </div>
  )
}
