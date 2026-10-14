import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"
import { SERVICE_LABELS, SERVICE_STATUS_LABELS, isAutomated, amountLabel } from "@/lib/services"
import { ServiceActions } from "./ServiceActions"
import type { XrayReport } from "@/lib/xray/types"
import type { CodeAuditResult } from "@/lib/ai-review/code-audit"

export const metadata = { title: "Заказ услуги" }

type RouteParams = { params: Promise<{ id: string }> }

export default async function AdminServiceOrderPage({ params }: RouteParams) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) redirect("/")

  const { id } = await params
  const order = await db.serviceOrder.findUnique({
    where: { id },
    include: { expert: { select: { id: true, name: true } } },
  })
  if (!order) notFound()

  const executors = await db.executor.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  const xray = order.xrayReport ? (order.xrayReport as unknown as XrayReport) : null
  const ai = order.aiResult ? (order.aiResult as unknown as CodeAuditResult) : null

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <Link href="/admin/services" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        К услугам
      </Link>

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">{SERVICE_LABELS[order.kind]}</h1>
        <Badge variant="outline">{SERVICE_STATUS_LABELS[order.status]}</Badge>
      </div>

      {/* Детали */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div><p className="text-xs text-muted-foreground">Сумма</p><p>{amountLabel(order.amount)}</p></div>
          <div><p className="text-xs text-muted-foreground">Создан</p><p>{new Date(order.createdAt).toLocaleString("ru-RU")}</p></div>
          <div><p className="text-xs text-muted-foreground">Email</p><p className="break-all">{order.email}</p></div>
          <div><p className="text-xs text-muted-foreground">Контакт</p><p className="break-all">{order.contact || "—"}</p></div>
          {order.paidAt && <div><p className="text-xs text-muted-foreground">Оплачен</p><p>{new Date(order.paidAt).toLocaleString("ru-RU")}</p></div>}
          {order.expert && <div><p className="text-xs text-muted-foreground">Эксперт</p><p>{order.expert.name}</p></div>}
        </div>
        {order.brief && (
          <div>
            <p className="text-xs text-muted-foreground">Запрос заказчика</p>
            <p className="whitespace-pre-wrap">{order.brief}</p>
          </div>
        )}
      </section>

      {/* X-Ray по прикреплённому коду */}
      {xray && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">X-Ray по коду</h2>
            {order.codeS3Key && !order.codeDeletedAt && (
              <a href={`/api/admin/services/${order.id}/code`} className="text-sm text-primary hover:underline">Скачать код →</a>
            )}
            {order.codeDeletedAt && <span className="text-xs text-muted-foreground">код удалён после сдачи</span>}
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

      {/* Результат AI-аудита */}
      {ai && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-2 text-sm">
          <h2 className="font-semibold">Заключение AI-аудита</h2>
          <p>{ai.summary}</p>
          <p className="text-muted-foreground">Безопасность {ai.security?.score}/10 · Качество {ai.quality?.score}/10</p>
          {ai.verdict && <p><b>Итог:</b> {ai.verdict}</p>}
        </section>
      )}

      {/* Управление */}
      <ServiceActions
        orderId={order.id}
        status={order.status}
        report={order.report ?? ""}
        expertId={order.expertId ?? ""}
        isExpertService={!isAutomated(order.kind)}
        executors={executors}
      />
    </div>
  )
}
