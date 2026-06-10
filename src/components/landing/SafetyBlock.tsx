import Link from "next/link"
import { ScanLine, UserCheck, RotateCcw, Sparkles } from "lucide-react"

const ITEMS = [
  {
    icon: ScanLine,
    title: "Автоматическое сканирование",
    text: "Код каждого продукта проходит статический анализ (Bandit, Semgrep, проверка по VirusTotal) и поиск опасных паттернов до того, как попадёт в каталог.",
  },
  {
    icon: UserCheck,
    title: "Ручная модерация",
    text: "Подозрительные продукты уходят модератору. Никакой обфускации, скрытых сетевых вызовов и чужого кода — это правила площадки.",
  },
  {
    icon: RotateCcw,
    title: "Споры и возвраты",
    text: "Деньги держатся в эскроу 7 дней. Если продукт не соответствует описанию — открываете спор, модератор разбирает переписку и возвращает оплату.",
  },
  {
    icon: Sparkles,
    title: "AI-аудит по запросу",
    text: "Перед покупкой можно заказать независимый разбор кода нейросетью за ₽390 — она ищет уязвимости и несоответствия описанию.",
  },
]

export function SafetyBlock() {
  return (
    <section className="border-y border-border bg-card/40">
      <div className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold text-foreground">Почему на ПОЛКЕ безопасно</h2>
        <p className="mt-2 text-center text-muted-foreground">
          Маркетплейс готовых программ — это риск нарваться на вредонос. Мы закрыли его системно.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {ITEMS.map((item, i) => (
            <div key={i} className="flex gap-4 rounded-lg border border-border bg-card p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <item.icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.text}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Подробнее о проверке —{" "}
          <Link href="/catalog" className="text-primary underline-offset-2 hover:underline">
            смотрите каталог
          </Link>
        </p>
      </div>
    </section>
  )
}
