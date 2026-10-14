import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { SERVICE_LABELS, SERVICE_STATUS_LABELS } from "@/lib/services"

export const metadata = { title: "Платные услуги" }

export default async function AdminServicesPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) redirect("/")

  const orders = await db.serviceOrder.findMany({
    where: { status: { not: "AWAITING_PAYMENT" } }, // неоплаченные не показываем
    orderBy: { createdAt: "desc" },
    take: 200,
  })
  const active = orders.filter((o) => !["CLOSED", "REFUNDED"].includes(o.status))
  const done = orders.filter((o) => ["CLOSED", "REFUNDED"].includes(o.status))

  function Row({ o }: { o: (typeof orders)[number] }) {
    return (
      <Link href={`/admin/services/${o.id}`} className="block px-4 py-3 hover:bg-muted/20">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{SERVICE_LABELS[o.kind]}</p>
            <p className="text-xs text-muted-foreground">
              {o.email} · {formatPrice(o.amount)} · {new Date(o.createdAt).toLocaleDateString("ru-RU")}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 text-xs">{SERVICE_STATUS_LABELS[o.status]}</Badge>
        </div>
      </Link>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Рабочий стол
      </Link>
      <h1 className="text-2xl font-semibold">Платные услуги</h1>

      <section className="space-y-3">
        <h2 className="font-semibold">В работе ({active.length})</h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет активных заказов.</p>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border">
            {active.map((o) => <Row key={o.id} o={o} />)}
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">История</h2>
          <div className="rounded-lg border border-border divide-y divide-border">
            {done.map((o) => <Row key={o.id} o={o} />)}
          </div>
        </section>
      )}
    </div>
  )
}
