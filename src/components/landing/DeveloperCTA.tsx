import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function DeveloperCTA() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16">
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card p-10 text-center">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
          Зарабатывайте на своих скриптах
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          У вас уже есть бот, парсер или 1С-обработка, которую вы писали для себя? Выложите её
          на ПОЛКУ — и она будет продаваться сама. Загрузка занимает 15 минут, площадка берёт
          на себя оплату, доставку и возвраты.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/sell" className="flex items-center gap-2">
              Как продавать
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/submit">Загрузить продукт</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
