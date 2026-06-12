import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/utils"
import { PayoutActions } from "./PayoutActions"
import { ArrowLeft } from "lucide-react"

export const metadata = { title: "Выплаты — ПОЛКА" }

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Запрошено",
  PROCESSING: "В обработке",
  PAID: "Выплачено",
  REJECTED: "Отклонено",
}
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  PROCESSING: "secondary",
  PAID: "default",
  REJECTED: "destructive",
}

export default async function AdminPayoutsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || user.role !== "ADMIN") redirect("/")

  const payouts = await db.payout.findMany({
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    take: 200,
    include: { developer: { select: { name: true, email: true } } },
  })

  const open = payouts.filter((p) => p.status === "PENDING" || p.status === "PROCESSING")
  const closed = payouts.filter((p) => p.status === "PAID" || p.status === "REJECTED")

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Рабочий стол
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Выплаты разработчикам</h1>
        <p className="text-sm text-muted-foreground mt-1">
          SLA: выплаты обрабатываются по вторникам и пятницам. Сумма резервируется на момент
          запроса; отклонение возвращает её на баланс разработчика.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">К обработке ({open.length})</h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет запросов в работе.</p>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border">
            {open.map((p) => (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{formatPrice(p.amount)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.developer.name ?? p.developer.email} ·{" "}
                    {new Date(p.requestedAt).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={STATUS_VARIANTS[p.status]}>{STATUS_LABELS[p.status]}</Badge>
                  <PayoutActions payoutId={p.id} status={p.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {closed.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">История</h2>
          <div className="rounded-lg border border-border divide-y divide-border">
            {closed.map((p) => (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{formatPrice(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.developer.name ?? p.developer.email} ·{" "}
                    {new Date(p.requestedAt).toLocaleDateString("ru-RU")}
                    {p.paidAt && <> → {new Date(p.paidAt).toLocaleDateString("ru-RU")}</>}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANTS[p.status]}>{STATUS_LABELS[p.status]}</Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
