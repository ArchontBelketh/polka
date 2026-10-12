import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"
import { REQUEST_STATUS_LABELS, REQUEST_CLOSED } from "@/lib/request-status"

export const metadata = { title: "Заявки" }

// Чтение времени — в обычной функции, не в теле рендера (react-hooks/purity).
function isStaleNew(status: string, createdAt: Date): boolean {
  return status === "NEW" && createdAt.getTime() < Date.now() - 24 * 3600_000
}

export default async function AdminRequestsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) redirect("/")

  const requests = await db.request.findMany({ orderBy: { createdAt: "desc" }, take: 200 })
  const open = requests.filter((r) => !REQUEST_CLOSED.includes(r.status))
  const closed = requests.filter((r) => REQUEST_CLOSED.includes(r.status))

  function Row({ r }: { r: (typeof requests)[number] }) {
    const stale = isStaleNew(r.status, r.createdAt)
    return (
      <Link
        href={`/admin/requests/${r.id}`}
        className={`block px-4 py-3 hover:bg-muted/20 ${stale ? "bg-amber-500/5" : ""}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{r.task.slice(0, 90)}</p>
            <p className="text-xs text-muted-foreground">
              {r.platform} · {r.contact} · {new Date(r.createdAt).toLocaleDateString("ru-RU")}
              {stale && <span className="ml-2 text-amber-400">без ответа &gt;24ч</span>}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 text-xs">
            {REQUEST_STATUS_LABELS[r.status] ?? r.status}
          </Badge>
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
      <h1 className="text-2xl font-semibold">Заявки</h1>

      <section className="space-y-3">
        <h2 className="font-semibold">В работе ({open.length})</h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет активных заявок.</p>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border">
            {open.map((r) => <Row key={r.id} r={r} />)}
          </div>
        )}
      </section>

      {closed.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">История</h2>
          <div className="rounded-lg border border-border divide-y divide-border">
            {closed.map((r) => <Row key={r.id} r={r} />)}
          </div>
        </section>
      )}
    </div>
  )
}
