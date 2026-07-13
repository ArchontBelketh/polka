import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { IncomeCalculator } from "@/components/landing/IncomeCalculator"
import { Upload, ScanLine, UserCheck, TrendingUp, Check, X } from "lucide-react"
import { SellCta } from "./SellCta"

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
    q: "Когда я получу деньги?",
    a: "Сумма за вычетом комиссии зачисляется на ваш баланс сразу после оплаты покупателем — без периода удержания. Запрос на вывод обрабатывается администратором по вторникам и пятницам; при отклонении сумма возвращается на баланс.",
  },
  {
    q: "Что такое слоты и сколько их?",
    a: "Слот — это место под один опубликованный продукт. На бесплатном тарифе доступно 2 слота. Нужно больше — докупаете слоты разово или переходите на Pro.",
  },
  {
    q: "Чем Pro лучше бесплатного тарифа?",
    a: "На Pro комиссия площадки снижается с 20% до 17% и доступно больше слотов. Подписка окупается, если вы продаёте регулярно.",
  },
  {
    q: "Бывают ли возвраты?",
    a: "Нет, продажи на площадке финальные — после оплаты возврат средств не производится. Если продукт окажется небезопасным или окажется чужим кодом, модерация снимает его с продажи. Для честных разработчиков это защита: недобросовестные авторы быстро отсеиваются.",
  },
  {
    q: "Можно ли обновлять продукт?",
    a: "Да. Вы загружаете новую версию файла — она проходит проверку, после чего покупатели получают обновление. Бейдж «Проверено вручную» при этом обновляется под новую версию.",
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
  return (
    <div className="space-y-4">
      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center space-y-6">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Ваш скрипт уже написан.{" "}
            <span className="text-primary">Пусть он продаётся сам</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Бот, парсер или 1С-обработка, которую вы делали под задачу, может приносить доход
            снова и снова. ПОЛКА берёт на себя оплату и доставку — вы получаете до 80%
            с каждой продажи.
          </p>
          <div className="flex items-center justify-center gap-3">
            <SellCta role={role} />
          </div>
        </div>
      </section>

      {/* Calculator */}
      <section className="mx-auto max-w-2xl px-4 py-12">
        <IncomeCalculator />
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-center text-2xl font-bold text-foreground">Условия</h2>
        <p className="mt-2 text-center text-muted-foreground">Начните бесплатно, расширяйтесь по мере роста</p>

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
