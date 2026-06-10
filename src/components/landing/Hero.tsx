import Link from "next/link"
import { Search, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 via-background to-background" />
      <div className="mx-auto max-w-4xl px-4 py-20 text-center space-y-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Каждый продукт проверяется перед публикацией
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Готовые программы для бизнеса —{" "}
            <span className="text-primary">с проверкой кода</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Telegram-боты, парсеры, Excel- и 1С-скрипты, автоматизация. Код каждого продукта
            проходит автоматическое сканирование и ручную модерацию. Деньги под защитой эскроу 7 дней.
          </p>
        </div>

        {/* Search → catalog */}
        <form action="/catalog" className="mx-auto flex max-w-xl items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              name="q"
              placeholder="Что вам нужно? Например: бот записи клиентов"
              className="h-11 pl-9 bg-card border-border"
            />
          </div>
          <Button type="submit" size="lg" className="h-11">
            Найти
          </Button>
        </form>

        <div className="flex items-center justify-center gap-3">
          <Button asChild size="lg" variant="outline">
            <Link href="/catalog">Смотреть каталог</Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/sell">Продавать на ПОЛКЕ</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
