import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import {
  SERVICE_KINDS, SERVICE_LABELS, SERVICE_TAGLINES, SERVICE_TURNAROUND,
  SERVICE_INCLUDES, SERVICE_PRICES, SERVICE_STATUS_LABELS, SLUG_BY_KIND, SERVICE_DISCLAIMER,
} from "@/lib/services"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

export const metadata: Metadata = {
  title: "Платные услуги",
  description:
    "Глубокий AI-аудит кода, расширенная приёмка работы подрядчика и «Спасение проекта», если разработчик пропал. Автоматический анализ — не гарантия безопасности.",
  alternates: { canonical: `${APP_URL}/services` },
}

export default async function ServicesPage() {
  const session = await auth()
  const myOrders = session?.user?.id
    ? await db.serviceOrder.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, kind: true, status: true, amount: true, createdAt: true },
      })
    : []

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Платные услуги ПОЛКИ</h1>
        <p className="text-muted-foreground">
          Собственные услуги сервиса: разбор кода, приёмка работы подрядчика и помощь, если разработчик пропал.
          Оплата на сайте, чек — от ПОЛКИ.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {SERVICE_KINDS.map((kind) => (
          <div key={kind} className="flex flex-col rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-foreground">{SERVICE_LABELS[kind]}</h2>
            <p className="mt-1 text-2xl font-bold text-primary">{formatPrice(SERVICE_PRICES[kind])}</p>
            <p className="mt-2 text-sm text-muted-foreground">{SERVICE_TAGLINES[kind]}</p>
            <ul className="mt-4 space-y-1.5">
              {SERVICE_INCLUDES[kind].map((it, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">{SERVICE_TURNAROUND[kind]}</p>
            <div className="mt-4 pt-1">
              <Button asChild className="w-full">
                <Link href={`/services/order?kind=${SLUG_BY_KIND[kind]}`}>Заказать</Link>
              </Button>
            </div>
          </div>
        ))}
      </div>

      <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
        {SERVICE_DISCLAIMER}
      </p>

      {myOrders.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Мои заказы</h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {myOrders.map((o) => (
              <li key={o.id}>
                <Link href={`/services/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40">
                  <div>
                    <p className="font-medium text-foreground">{SERVICE_LABELS[o.kind]}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString("ru-RU")} · {formatPrice(o.amount)}
                    </p>
                  </div>
                  <Badge variant="outline">{SERVICE_STATUS_LABELS[o.status]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
