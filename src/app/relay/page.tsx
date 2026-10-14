import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getSiteSettings } from "@/lib/site-settings"
import { pluralize } from "@/lib/plural"
import {
  RELAY_WHEN, RELAY_PROMISE, RELAY_NOT_PROMISE, RELAY_NEED_FROM_CUSTOMER,
  ACCESS_TRANSFER_HINT, ACCESS_CHECKLIST,
} from "@/lib/relay"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

export const metadata: Metadata = {
  title: "Правила «Эстафеты»",
  description:
    "Что происходит, если исполнитель пропал: подберём замену из дежурных разработчиков, работа продолжится с вашего репозитория. Что обещаем и чего не обещаем.",
  alternates: { canonical: `${APP_URL}/relay` },
}

function List({ items, marker = "•" }: { items: string[]; marker?: string }) {
  return (
    <ul className="space-y-1.5 text-sm text-muted-foreground">
      {items.map((it, i) => (
        <li key={i}>{marker} {it}</li>
      ))}
    </ul>
  )
}

export default async function RelayPage() {
  const site = await getSiteSettings()
  const slaLine = site.relaySlaEnabled
    ? `Обычно подбираем замену в течение ${pluralize(site.relaySlaDays, { one: "дня", few: "дней", many: "дней" })}.`
    : "Подберём замену из дежурных разработчиков (конкретный срок пока не обещаем)."

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Правила «Эстафеты»</h1>
        <p className="text-muted-foreground">
          Главный риск заказной разработки — исполнитель пропадает, и проект встаёт. «Эстафета» —
          это наш порядок действий, чтобы работа продолжилась с другим разработчиком.
        </p>
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">{slaLine}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Когда включается</h2>
        <List items={RELAY_WHEN} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Что мы обещаем</h2>
        <List items={RELAY_PROMISE} marker="✓" />
      </section>

      <section className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-5">
        <h2 className="text-lg font-semibold text-foreground">Чего мы не обещаем</h2>
        <List items={RELAY_NOT_PROMISE} marker="—" />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Что нужно от вас</h2>
        <List items={RELAY_NEED_FROM_CUSTOMER} marker="→" />
      </section>

      {/* Сейф доступов (ТЗ 12.4) */}
      <section className="space-y-3 border-t border-border pt-8">
        <h2 className="text-xl font-semibold text-foreground">Доступы под контролем</h2>
        <p className="text-sm text-muted-foreground">{ACCESS_TRANSFER_HINT}</p>
        <p className="text-sm text-muted-foreground">
          ПОЛКА паролей не хранит. После сдачи работы пройдите по чеклисту:
        </p>
        <List items={ACCESS_CHECKLIST} marker="☐" />
      </section>

      <section className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/request">Описать задачу</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/services/order?kind=project-rescue">Спасение проекта</Link>
        </Button>
      </section>
    </div>
  )
}
