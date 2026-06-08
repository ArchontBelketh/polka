import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CATEGORY_LABELS } from "@/types"

export const metadata = { title: "Рабочий стол модератора — ПОЛКА" }

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

  const [pendingCount, scanFailedCount, todayReviewed, recentLogs] = await Promise.all([
    db.product.count({ where: { status: "PENDING" } }),
    db.product.count({ where: { status: "SCAN_FAILED" } }),
    db.moderationLog.count({ where: { createdAt: { gte: today } } }),
    db.moderationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { product: { select: { title: true, id: true, category: true } } },
    }),
  ])

  const queueTotal = pendingCount + scanFailedCount

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Рабочий стол модератора</h1>
        <Button asChild variant={queueTotal > 0 ? "default" : "outline"}>
          <Link href="/admin/queue">
            Очередь{queueTotal > 0 ? ` (${queueTotal})` : ""}
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="В очереди" value={String(pendingCount)} urgent={pendingCount > 0} />
        <StatCard label="Отклонено сканером" value={String(scanFailedCount)} urgent={scanFailedCount > 0} />
        <StatCard label="Проверено сегодня" value={String(todayReviewed)} />
      </div>

      {queueTotal === 0 && recentLogs.length === 0 && (
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

function StatCard({ label, value, urgent }: { label: string; value: string; urgent?: boolean }) {
  return (
    <div className={`rounded-lg border bg-card p-4 space-y-1 ${urgent ? "border-primary/40" : "border-border"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${urgent ? "text-primary" : ""}`}>{value}</p>
    </div>
  )
}
