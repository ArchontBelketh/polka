import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { db } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/utils"
import { CATEGORY_LABELS } from "@/types"
import { TechBadge } from "@/components/catalog/TechBadge"
import { ModerationActions } from "./ModerationActions"
import type { ScanFinding } from "@/types"

type RouteParams = { params: Promise<{ id: string }> }

const SCAN_STATUS_LABEL: Record<string, string> = {
  PENDING: "Ожидает",
  CLEAN: "Чисто",
  WARNING: "Предупреждения",
  BLOCKED: "Заблокирован",
}
const SCAN_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  CLEAN: "default",
  WARNING: "secondary",
  BLOCKED: "destructive",
  PENDING: "outline",
}

const PRODUCT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Черновик",
  PENDING: "На проверке",
  SCAN_FAILED: "Отклонён сканером",
  APPROVED: "Опубликован",
  REJECTED: "Отклонён",
  SUSPENDED: "Отозван",
}
const PRODUCT_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline",
  PENDING: "default",
  SCAN_FAILED: "destructive",
  APPROVED: "secondary",
  REJECTED: "destructive",
  SUSPENDED: "outline",
}

const ACTION_LABELS: Record<string, string> = {
  APPROVED: "Одобрен",
  AUTO_APPROVED: "Авто-одобрен",
  AUTO_REJECTED: "Авто-отклонён",
  QUEUED: "В очереди",
  REJECTED: "Отклонён",
  CHANGES_REQUESTED: "Запрошены правки",
  SUSPENDED: "Отозван",
  RESTORED: "Восстановлен",
}

const DECISION_LABELS: Record<string, string> = {
  AUTO_APPROVE: "Авто-одобрение",
  AUTO_APPROVE_MONITOR: "Авто-одобрение с мониторингом",
  AUTO_REJECT: "Авто-отклонение",
  QUEUE_LOW: "Очередь (низкий приоритет)",
  QUEUE_HIGH: "Очередь (нормальный приоритет)",
  QUEUE_URGENT: "Очередь (срочно)",
}

// Which statuses belong to the moderation queue
const IN_QUEUE = new Set(["PENDING", "SCAN_FAILED"])

export default async function AdminReviewPage({ params }: RouteParams) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) redirect("/")

  const { id } = await params
  const product = await db.product.findUnique({
    where: { id },
    include: {
      author: { select: { name: true, email: true, telegramHandle: true } },
      files: true,
      scanResult: true,
      moderationLogs: { orderBy: { createdAt: "desc" }, take: 20 },
      _count: { select: { purchases: true } },
    },
  })

  if (!product) notFound()

  const findings = (product.scanResult?.findings ?? []) as unknown as ScanFinding[]
  const critical = findings.filter((f) => f.severity === "critical")
  const warnings = findings.filter((f) => f.severity === "warning")

  const backHref = IN_QUEUE.has(product.status) ? "/admin/queue" : "/admin"
  const backLabel = IN_QUEUE.has(product.status) ? "← Очередь" : "← Рабочий стол"

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            <a href={backHref} className="hover:underline">{backLabel}</a>
          </p>
          <h1 className="text-2xl font-semibold">{product.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {CATEGORY_LABELS[product.category as keyof typeof CATEGORY_LABELS]} · {formatPrice(product.price)}
          </p>
        </div>
        <Badge variant={PRODUCT_STATUS_VARIANT[product.status] ?? "outline"}>
          {PRODUCT_STATUS_LABEL[product.status] ?? product.status}
        </Badge>
      </div>

      {/* Product info */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold">Описание</h2>
        <p className="text-sm text-muted-foreground">{product.shortDesc}</p>
        <p className="text-sm whitespace-pre-wrap">{product.fullDesc}</p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {product.targetAudience && (
            <div>
              <p className="text-muted-foreground">Аудитория</p>
              <p>{product.targetAudience}</p>
            </div>
          )}
          {product.techStack.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1.5">Стек</p>
              <div className="flex flex-wrap gap-1">
                {product.techStack.map(tag => (
                  <TechBadge key={tag} label={tag} />
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-muted-foreground">Автор</p>
            <p>{product.author.name ?? product.author.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Лицензия</p>
            <p>{product.license}</p>
          </div>
        </div>
        <div>
          <p className="text-muted-foreground text-sm mb-2">Функции</p>
          <ul className="space-y-1">
            {product.features.map((f, i) => (
              <li key={i} className="text-sm flex items-center gap-2">
                <span className="text-primary">✓</span>{f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Files */}
      {product.files.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold">Файлы ({product.files.length})</h2>
          <ul className="space-y-2">
            {product.files.map((f) => (
              <li key={f.id} className="flex items-center justify-between text-sm">
                <span className="font-mono">{f.fileName}</span>
                <span className="text-muted-foreground">
                  {f.format} · {(f.fileSize / 1024).toFixed(1)} КБ
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Scan results */}
      {product.scanResult && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Результат сканирования</h2>
            <Badge variant={SCAN_VARIANTS[product.scanResult.status]}>
              {SCAN_STATUS_LABEL[product.scanResult.status]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Инструменты: {product.scanResult.toolsRun.join(", ")}
          </p>

          {critical.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-red-400">Критические ({critical.length})</p>
              <ul className="space-y-2">
                {critical.map((f, i) => (
                  <li key={i} className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm">
                    <p className="font-medium text-red-400">{f.message}</p>
                    {f.file && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {f.file}{f.line ? `:${f.line}` : ""}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-yellow-400">Предупреждения ({warnings.length})</p>
              <ul className="space-y-2">
                {warnings.map((f, i) => (
                  <li key={i} className="rounded-md bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-sm">
                    <p className="text-yellow-300">{f.message}</p>
                    {f.file && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {f.file}{f.line ? `:${f.line}` : ""}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {findings.length === 0 && (
            <p className="text-sm text-muted-foreground">Угроз не обнаружено.</p>
          )}
        </section>
      )}

      {/* Auto-moderation */}
      {product.riskScore != null && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Автоматическая оценка</h2>
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-bold tabular-nums ${
                product.riskScore > 60 ? "text-red-400" :
                product.riskScore > 20 ? "text-yellow-400" : "text-green-400"
              }`}>{product.riskScore}</span>
              {product.autoDecision && (
                <Badge variant="outline">{DECISION_LABELS[product.autoDecision] ?? product.autoDecision}</Badge>
              )}
            </div>
          </div>

          {/* Factors */}
          {(() => {
            const factors = (product as typeof product & { aiReviewFlags?: { reasons?: string[] } | null })
            const flags = factors.aiReviewFlags
            const factorRows = (product.moderationLogs.find((l) =>
              l.action === "AUTO_APPROVED" || l.action === "AUTO_REJECTED" || l.action === "QUEUED"
            )?.comment ?? "").match(/score=\d+[^.]*\.(.*)/)?.[1]?.trim()

            return (
              <div className="space-y-2 text-sm">
                {factorRows && (
                  <p className="text-xs text-muted-foreground font-mono">{factorRows}</p>
                )}
                {flags && typeof flags === "object" && "provider" in flags && (flags as { provider: string }).provider !== "skipped" && (
                  <div className="rounded-md bg-muted/40 px-3 py-2 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI-флаги</p>
                    <div className="flex gap-3 text-sm">
                      <span className={(flags as { mismatch?: boolean }).mismatch ? "text-red-400" : "text-green-400"}>
                        {(flags as { mismatch?: boolean }).mismatch ? "⚠ Несоответствие" : "✓ Соответствие"}
                      </span>
                      <span className={(flags as { suspicious?: boolean }).suspicious ? "text-red-400" : "text-green-400"}>
                        {(flags as { suspicious?: boolean }).suspicious ? "⚠ Подозрительный контент" : "✓ Контент ОК"}
                      </span>
                    </div>
                    {(flags as { reasons?: string[] }).reasons?.length ? (
                      <p className="text-xs text-muted-foreground">{(flags as { reasons: string[] }).reasons.join("; ")}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground opacity-60">Провайдер: {(flags as { provider: string }).provider}</p>
                  </div>
                )}
              </div>
            )
          })()}
        </section>
      )}

      {/* Moderation history */}
      {product.moderationLogs.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold">История</h2>
          <ul className="space-y-2">
            {product.moderationLogs.map((log) => (
              <li key={log.id} className="text-sm flex items-start gap-3">
                <Badge variant="outline" className="shrink-0">
                  {ACTION_LABELS[log.action] ?? log.action}
                </Badge>
                <span className="text-muted-foreground">
                  {log.comment && <span>{log.comment} · </span>}
                  {log.createdAt.toLocaleDateString("ru-RU")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Action panel */}
      <ModerationActions productId={product.id} productStatus={product.status} />
    </div>
  )
}
