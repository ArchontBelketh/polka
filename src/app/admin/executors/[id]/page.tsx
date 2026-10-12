import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ExecutorEditForm } from "./ExecutorEditForm"

export const metadata = { title: "Исполнитель" }

type RouteParams = { params: Promise<{ id: string }> }

export default async function AdminExecutorPage({ params }: RouteParams) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) redirect("/")

  const { id } = await params
  const e = await db.executor.findUnique({ where: { id } })
  if (!e) notFound()

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <Link href="/admin/executors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        К пулу
      </Link>
      <h1 className="text-2xl font-semibold">{e.name}</h1>

      <ExecutorEditForm
        executor={{
          id: e.id,
          name: e.name,
          contact: e.contact,
          stack: e.stack ?? "",
          active: e.active,
          inn: e.inn ?? "",
          taxStatus: e.taxStatus ?? "",
          taxVerified: e.taxVerified,
          taxCheckedAt: e.taxCheckedAt ? e.taxCheckedAt.toISOString() : null,
          xrayReportUrl: e.xrayReportUrl ?? "",
          freeRequestsLeft: e.freeRequestsLeft,
          requestsSent: e.requestsSent,
          ordersTaken: e.ordersTaken,
          relayCount: e.relayCount,
          notes: e.notes ?? "",
        }}
      />
    </div>
  )
}
