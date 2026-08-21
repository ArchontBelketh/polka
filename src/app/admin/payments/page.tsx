import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { formatPrice, cn } from "@/lib/utils"
import { PaymentActions } from "./PaymentActions"

export const metadata = { title: "Платежи" }

const TYPE_LABELS: Record<string, string> = {
  purchase: "Покупка товара",
  slots: "Слоты",
  pro: "Pro-подписка",
  ai_review: "AI-ревью",
  listing_fee: "Тариф за размещение",
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Ожидает",
  CONFIRMED: "Оплачено",
  FAILED: "Ошибка / отменён",
}
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  CONFIRMED: "default",
  FAILED: "destructive",
}

const FILTERS = [
  { key: "all", label: "Все" },
  { key: "PENDING", label: "Ожидают" },
  { key: "CONFIRMED", label: "Оплачены" },
  { key: "FAILED", label: "Ошибки" },
]

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function AdminPaymentsPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const admin = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (admin?.role !== "ADMIN") redirect("/")

  const { status } = await searchParams
  const filter = FILTERS.some((f) => f.key === status) ? status! : "all"

  const [intents, counts] = await Promise.all([
    db.paymentIntent.findMany({
      where: filter === "all" ? {} : { status: filter },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.paymentIntent.groupBy({ by: ["status"], _count: { _all: true } }),
  ])

  const countByStatus = new Map(counts.map((c) => [c.status, c._count._all]))
  const pendingCount = countByStatus.get("PENDING") ?? 0

  // Email инициаторов платежей
  const userIds = [...new Set(intents.map((i) => i.userId).filter((v): v is string => !!v))]
  const users = userIds.length
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } })
    : []
  const emailById = new Map(users.map((u) => [u.id, u.email]))

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Платежи</h1>
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          ← Рабочий стол
        </Link>
      </div>

      {pendingCount > 0 && (
        <p className="text-sm text-muted-foreground">
          Незавершённых платежей: <span className="text-foreground font-medium">{pendingCount}</span>.
          Кнопка «Проверить» сверяет статус с Т-Банком (полезно при пропущенном вебхуке).
        </p>
      )}

      {/* Фильтры */}
      <div className="flex gap-1 border-b border-border">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/admin/payments" : `/admin/payments?status=${f.key}`}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              filter === f.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {intents.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">Платежей нет.</div>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border">
          {intents.map((it) => {
            const payload = (it.payload ?? {}) as Record<string, string>
            const refundablePurchaseId =
              it.type === "purchase" && it.status === "CONFIRMED" ? payload.purchaseId : undefined
            return (
              <div key={it.id} className="px-4 py-3 flex items-start gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{TYPE_LABELS[it.type] ?? it.type}</span>
                    <Badge variant={STATUS_VARIANTS[it.status] ?? "outline"} className="text-xs">
                      {STATUS_LABELS[it.status] ?? it.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{formatPrice(it.amount)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {it.userId ? emailById.get(it.userId) ?? it.userId : "—"} ·{" "}
                    {new Date(it.createdAt).toLocaleString("ru-RU", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-[11px] text-muted-foreground/70 font-mono truncate">
                    order {it.orderId}
                    {it.paymentId ? ` · pay ${it.paymentId}` : " · нет PaymentId"}
                  </p>
                </div>
                <PaymentActions
                  intentId={it.id}
                  status={it.status}
                  hasPaymentId={!!it.paymentId}
                  refundablePurchaseId={refundablePurchaseId}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
