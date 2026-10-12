import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import { AddExecutor } from "./AddExecutor"

export const metadata = { title: "Пул исполнителей" }

export default async function AdminExecutorsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) redirect("/")

  const executors = await db.executor.findMany({ orderBy: [{ active: "desc" }, { createdAt: "desc" }] })

  function Row({ e }: { e: (typeof executors)[number] }) {
    return (
      <Link href={`/admin/executors/${e.id}`} className="block px-4 py-3 hover:bg-muted/20">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              {e.name}
              {e.taxVerified && <ShieldCheck className="h-3.5 w-3.5 text-cyan" />}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {e.contact}{e.stack ? ` · ${e.stack}` : ""} · заявок {e.requestsSent} · заказов {e.ordersTaken} · бесплатно осталось {e.freeRequestsLeft}
            </p>
          </div>
          <Badge variant={e.active ? "default" : "secondary"} className="shrink-0 text-xs">
            {e.active ? "Дежурный" : "Пауза"}
          </Badge>
        </div>
      </Link>
    )
  }

  const onDuty = executors.filter((e) => e.active)
  const paused = executors.filter((e) => !e.active)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Рабочий стол
      </Link>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Пул исполнителей</h1>
      </div>

      <AddExecutor />

      <section className="space-y-3">
        <h2 className="font-semibold">Дежурные ({onDuty.length})</h2>
        {onDuty.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет дежурных исполнителей.</p>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border">
            {onDuty.map((e) => <Row key={e.id} e={e} />)}
          </div>
        )}
      </section>

      {paused.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">На паузе</h2>
          <div className="rounded-lg border border-border divide-y divide-border">
            {paused.map((e) => <Row key={e.id} e={e} />)}
          </div>
        </section>
      )}
    </div>
  )
}
