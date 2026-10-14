import type { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/utils"
import { SERVICE_LABELS, SERVICE_STATUS_LABELS, SERVICE_TURNAROUND, SERVICE_DISCLAIMER } from "@/lib/services"
import type { CodeAuditResult } from "@/lib/ai-review/code-audit"

export const metadata: Metadata = { title: "Заказ услуги", robots: { index: false } }

type RouteParams = { params: Promise<{ id: string }> }

export default async function ServiceOrderPage({ params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const role = (session.user as { role?: string }).role ?? ""
  const isStaff = ["ADMIN", "MODERATOR"].includes(role)

  const { id } = await params
  const order = await db.serviceOrder.findUnique({ where: { id } })
  if (!order) notFound()
  if (order.userId !== session.user.id && !isStaff) redirect("/")

  const ai = order.aiResult ? (order.aiResult as unknown as CodeAuditResult) : null

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{SERVICE_LABELS[order.kind]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(order.createdAt).toLocaleString("ru-RU")} · {formatPrice(order.amount)}
          </p>
        </div>
        <Badge variant="outline">{SERVICE_STATUS_LABELS[order.status]}</Badge>
      </div>

      {/* Статусные подсказки */}
      {order.status === "AWAITING_PAYMENT" && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
          Заказ ждёт оплаты. Если вы закрыли окно оплаты — оформите заказ заново на странице услуги.
        </p>
      )}
      {(order.status === "PAID" || order.status === "IN_PROGRESS") && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Оплата получена, готовим отчёт. {SERVICE_TURNAROUND[order.kind]}. Пришлём письмо, когда будет готово.
        </p>
      )}
      {order.status === "REFUNDED" && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          По заказу оформлён возврат.
        </p>
      )}

      {order.brief && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-1.5">
          <p className="text-xs text-muted-foreground">Ваш запрос</p>
          <p className="whitespace-pre-wrap text-sm">{order.brief}</p>
        </section>
      )}

      {/* AI-отчёт */}
      {ai && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Заключение AI-аудита</h2>
          <p className="text-sm">{ai.summary}</p>

          <ScoreBlock title="Безопасность" score={ai.security.score} summary={ai.security.summary} issues={ai.security.issues} />
          <ScoreBlock title="Качество" score={ai.quality.score} summary={ai.quality.summary} issues={ai.quality.issues} />

          {ai.xray_explained?.length > 0 && (
            <ListBlock title="Что показал X-Ray" items={ai.xray_explained} />
          )}
          {ai.recommendations?.length > 0 && (
            <ListBlock title="Рекомендации" items={ai.recommendations} />
          )}

          {ai.verdict && (
            <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <b>Итог:</b> {ai.verdict}
            </p>
          )}
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">{SERVICE_DISCLAIMER}</p>
        </section>
      )}

      {/* Отчёт эксперта */}
      {order.report && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Отчёт</h2>
          <div className="whitespace-pre-wrap text-sm">{order.report}</div>
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">{SERVICE_DISCLAIMER}</p>
        </section>
      )}
    </div>
  )
}

function ScoreBlock({ title, score, summary, issues }: { title: string; score: number; summary: string; issues: string[] }) {
  return (
    <div>
      <h3 className="font-medium text-foreground">{title} — {score}/10</h3>
      {summary && <p className="mt-0.5 text-sm text-muted-foreground">{summary}</p>}
      {issues?.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
          {issues.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      )}
    </div>
  )
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="font-medium text-foreground">{title}</h3>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  )
}
