import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"
import { REQUEST_STATUS_LABELS } from "@/lib/request-status"
import { RequestActions } from "./RequestActions"
import { AssignExecutors } from "./AssignExecutors"
import type { XrayReport } from "@/lib/xray/types"

export const metadata = { title: "Заявка" }

type RouteParams = { params: Promise<{ id: string }> }

export default async function AdminRequestPage({ params }: RouteParams) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) redirect("/")

  const { id } = await params
  const request = await db.request.findUnique({
    where: { id },
    include: {
      statusLogs: { orderBy: { createdAt: "desc" } },
      assignments: { include: { executor: { select: { id: true, name: true } } } },
    },
  })
  if (!request) notFound()

  const activeExecutors = await db.executor.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  const assignedIds = new Set(request.assignments.map((a) => a.executorId))
  const available = activeExecutors.filter((e) => !assignedIds.has(e.id))
  const assigned = request.assignments.map((a) => ({
    id: a.id,
    executorName: a.executor.name,
    responded: a.responded,
  }))

  const xray = request.xrayReport ? (request.xrayReport as unknown as XrayReport) : null

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <Link href="/admin/requests" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        К заявкам
      </Link>

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">Заявка</h1>
        <Badge variant="outline">{REQUEST_STATUS_LABELS[request.status] ?? request.status}</Badge>
      </div>

      {/* Детали */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Что нужно сделать</p>
          <p className="whitespace-pre-wrap">{request.task}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><p className="text-xs text-muted-foreground">Где работает</p><p>{request.platform}</p></div>
          <div><p className="text-xs text-muted-foreground">Срок</p><p>{request.deadline || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Бюджет</p><p>{request.budget || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Создана</p><p>{new Date(request.createdAt).toLocaleString("ru-RU")}</p></div>
          <div><p className="text-xs text-muted-foreground">Контакт</p><p className="break-all">{request.contact}</p></div>
          <div><p className="text-xs text-muted-foreground">Мессенджер</p><p>{request.messenger || "—"}</p></div>
        </div>
        <p className="text-xs text-muted-foreground">
          Согласия: ПДн {request.consentPd ? "✓" : "—"} · передача контактов {request.consentContacts ? "✓" : "—"}
        </p>
      </section>

      {/* X-Ray по прикреплённому коду */}
      {xray && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">X-Ray по прикреплённому коду</h2>
            {request.codeS3Key && (
              <a href={`/api/admin/requests/${request.id}/code`} className="text-sm text-primary hover:underline">
                Скачать код →
              </a>
            )}
          </div>
          <ul className="space-y-0.5 text-sm text-muted-foreground">
            <li>Интернет: {xray.facts.internet.length} · Файлы: {xray.facts.files.length} · Команды: {xray.facts.commands.length}</li>
            <li>Секреты: {xray.facts.secrets.length} · Подозрительное: {xray.facts.suspicious.length} · Уязвимости: {xray.vulns.length}</li>
            {xray.addresses.urls.length + xray.addresses.ips.length > 0 && (
              <li className="break-all">Адреса: {[...xray.addresses.urls, ...xray.addresses.ips].join(", ")}</li>
            )}
          </ul>
        </section>
      )}

      {/* Управление */}
      <RequestActions
        requestId={request.id}
        status={request.status}
        notes={request.notes ?? ""}
        spec={request.spec ?? ""}
        kworkUrl={request.kworkUrl ?? ""}
      />

      {/* Исполнители */}
      <AssignExecutors
        requestId={request.id}
        consentContacts={request.consentContacts}
        available={available}
        assigned={assigned}
      />

      {/* История статусов */}
      {request.statusLogs.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold">История</h2>
          <ul className="space-y-2">
            {request.statusLogs.map((log) => (
              <li key={log.id} className="flex items-start gap-3 text-sm">
                <Badge variant="outline" className="shrink-0 text-xs">
                  {REQUEST_STATUS_LABELS[log.status] ?? log.status}
                </Badge>
                <span className="text-muted-foreground">
                  {log.comment && <span>{log.comment} · </span>}
                  {new Date(log.createdAt).toLocaleDateString("ru-RU")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
