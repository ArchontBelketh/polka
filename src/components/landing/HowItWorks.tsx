import { Search, CreditCard, Download } from "lucide-react"

const STEPS = [
  {
    icon: Search,
    title: "Выбрали продукт",
    text: "В каталоге видно, что входит в покупку, системные требования и отзывы. До покупки можно задать вопрос автору.",
  },
  {
    icon: CreditCard,
    title: "Оплатили",
    text: "Деньги замораживаются в эскроу на 7 дней. Если продукт не работает — вы оформляете возврат, не теряя ни рубля.",
  },
  {
    icon: Download,
    title: "Скачали и запустили",
    text: "Файлы доступны сразу после оплаты вместе с инструкцией по установке. Что-то не запустилось — пишете разработчику.",
  },
]

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16">
      <h2 className="text-center text-2xl font-bold text-foreground">Как это работает</h2>
      <p className="mt-2 text-center text-muted-foreground">Три шага от выбора до запуска</p>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <div key={i} className="relative rounded-lg border border-border bg-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <step.icon className="h-5 w-5" />
              </div>
              <span className="text-3xl font-bold text-muted-foreground/20">{i + 1}</span>
            </div>
            <h3 className="font-semibold text-foreground">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
