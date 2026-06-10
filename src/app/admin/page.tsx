import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CATEGORY_LABELS } from "@/types"
import { formatPrice } from "@/lib/utils"

export const metadata = { title: "Рабочий стол — ПОЛКА" }

const ACTION_LABELS: Record<string, string> = {
  APPROVED: "Одобрен",
  REJECTED: "Отклонён",
  CHANGES_REQUESTED: "Запрошены правки",
}
const ACTION_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  APPROVED: "secondary",
  REJECTED: "destructive",
  CHANGES_REQUESTED: "outline",
}

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) redirect("/")

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  const [pendingCount, scanFailedCount, todayReviewed, openTickets, disputedCount, recentLogs] = await Promise.all([
    db.product.count({ where: { status: "PENDING" } }),
    db.product.count({ where: { status: "SCAN_FAILED" } }),
    db.moderationLog.count({ where: { createdAt: { gte: today } } }),
    db.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.purchase.count({ where: { status: "DISPUTED" } }),
    db.moderationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { product: { select: { title: true, id: true, category: true } } },
    }),
  ])

  const queueTotal = pendingCount + scanFailedCount

  // Business stats — only for ADMIN role
  let adminStats: {
    totalGmv: number
    monthGmv: number
    totalUsers: number
    newUsers: number
    activeProducts: number
    topProducts: { id: string; title: string; salesCount: number; price: number }[]
  } | null = null

  if (user.role === "ADMIN") {
    const [totalAgg, monthAgg, totalUsers, newUsers, activeProducts, topProducts] = await Promise.all([
      db.purchase.aggregate({
        where: { status: { in: ["PAID", "DELIVERED"] } },
        _sum: { amount: true },
      }),
      db.purchase.aggregate({
        where: { status: { in: ["PAID", "DELIVERED"] }, paidAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: monthStart } } }),
      db.product.count({ where: { status: "APPROVED" } }),
      db.product.findMany({
        where: { status: "APPROVED" },
        orderBy: { salesCount: "desc" },
        take: 5,
        select: { id: true, title: true, salesCount: true, price: true },
      }),
    ])

    adminStats = {
      totalGmv:       totalAgg._sum.amount ?? 0,
      monthGmv:       monthAgg._sum.amount ?? 0,
      totalUsers,
      newUsers,
      activeProducts,
      topProducts,
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Рабочий стол</h1>
        <div className="flex items-center gap-2">
          {user.role === "ADMIN" && (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/users">Пользователи</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/coupons">Купоны</Link>
              </Button>
            </>
          )}
          <Button asChild variant={queueTotal > 0 ? "default" : "outline"}>
            <Link href="/admin/queue">
              Очередь{queueTotal > 0 ? ` (${queueTotal})` : ""}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="В очереди" value={String(pendingCount)} urgent={pendingCount > 0} />
        <StatCard label="Отклонено сканером" value={String(scanFailedCount)} urgent={scanFailedCount > 0} />
        <StatCard label="Проверено сегодня" value={String(todayReviewed)} />
        <StatCard
          label="Открытых обращений"
          value={String(openTickets)}
          urgent={openTickets > 0}
          href="/admin/support"
        />
        <StatCard
          label="Споров"
          value={String(disputedCount)}
          urgent={disputedCount > 0}
          href="/admin/disputes"
        />
      </div>

      {/* Business stats — ADMIN only */}
      {adminStats && (
        <section className="space-y-4">
          <h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">
            Аналитика платформы
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <StatCard label="GMV всего"     value={formatPrice(adminStats.totalGmv)} />
            <StatCard label="GMV за месяц"  value={formatPrice(adminStats.monthGmv)} />
            <StatCard label="Пользователей" value={String(adminStats.totalUsers)} />
            <StatCard label="Новых за месяц" value={`+${adminStats.newUsers}`} />
            <StatCard label="Продуктов"     value={String(adminStats.activeProducts)} />
          </div>

          {adminStats.topProducts.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <p className="text-sm font-medium">Топ-5 продуктов по продажам</p>
              <ol className="space-y-2">
                {adminStats.topProducts.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground tabular-nums w-4">{i + 1}.</span>
                    <Link
                      href={`/admin/review/${p.id}`}
                      className="flex-1 truncate hover:underline underline-offset-4"
                    >
                      {p.title}
                    </Link>
                    <span className="text-muted-foreground shrink-0">
                      {p.salesCount} продаж · {formatPrice(p.price)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}

      {queueTotal === 0 && recentLogs.length === 0 && !adminStats && (
        <div className="py-20 text-center text-muted-foreground">
          Очередь пуста и действий ещё не было.
        </div>
      )}

      {recentLogs.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Последние действия</h2>
          <div className="rounded-lg border border-border divide-y divide-border">
            {recentLogs.map((log) => (
              <div key={log.id} className="px-4 py-3 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/admin/review/${log.product.id}`}
                    className="text-sm font-medium hover:underline underline-offset-4 truncate block"
                  >
                    {log.product.title}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {CATEGORY_LABELS[log.product.category as keyof typeof CATEGORY_LABELS]} ·{" "}
                    {new Date(log.createdAt).toLocaleString("ru-RU", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {log.comment && (
                    <p className="text-xs text-muted-foreground mt-1 italic line-clamp-1">
                      «{log.comment}»
                    </p>
                  )}
                </div>
                <Badge variant={ACTION_VARIANTS[log.action] ?? "outline"} className="shrink-0 mt-0.5">
                  {ACTION_LABELS[log.action] ?? log.action}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function StatCard({ label, value, urgent, href }: { label: string; value: string; urgent?: boolean; href?: string }) {
  const inner = (
    <div className={`rounded-lg border bg-card p-4 space-y-1 ${urgent ? "border-primary/40" : "border-border"} ${href ? "hover:bg-muted/30 transition-colors" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${urgent ? "text-primary" : ""}`}>{value}</p>
    </div>
  )
  if (href) return <a href={href}>{inner}</a>
  return inner
}
