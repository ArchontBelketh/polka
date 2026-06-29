import { auth } from "@/lib/auth"
import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { db } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/utils"
import { CATEGORY_LABELS } from "@/types"
import { TechBadge } from "@/components/catalog/TechBadge"
import { ProductActions } from "./ProductActions"
import { NewVersionForm } from "./NewVersionForm"
import { VersionActions } from "./VersionActions"

type RouteParams = { params: Promise<{ id: string }> }

const VERSION_STATUS_LABELS: Record<string, string> = {
  PENDING:   "На проверке",
  APPROVED:  "Опубликована",
  REJECTED:  "Отклонена",
  SUSPENDED: "Снята",
}
const VERSION_STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING:   "outline",
  APPROVED:  "default",
  REJECTED:  "destructive",
  SUSPENDED: "secondary",
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  PENDING: "На проверке",
  SCAN_FAILED: "Не прошёл сканирование",
  APPROVED: "Опубликован",
  REJECTED: "Отклонён",
  SUSPENDED: "Приостановлен",
}
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  PENDING: "outline",
  SCAN_FAILED: "destructive",
  APPROVED: "default",
  REJECTED: "destructive",
  SUSPENDED: "secondary",
}

const LOG_ACTION_LABELS: Record<string, string> = {
  APPROVED: "Одобрен",
  REJECTED: "Отклонён",
  CHANGES_REQUESTED: "Запрошены правки",
  SUSPENDED: "Приостановлен",
  RESTORED: "Восстановлен",
  AUTO_APPROVED: "Одобрено автоматически",
  AUTO_REJECTED: "Не пройдена проверка",
  QUEUED: "На ручной проверке",
}

// Авто-логи содержат внутренние детали (score, коды правил) — разработчику
// показываем человекочитаемое описание вместо сырого комментария.
const AUTO_LOG_MESSAGES: Record<string, string> = {
  AUTO_APPROVED: "Продукт прошёл автоматическую проверку безопасности и опубликован.",
  AUTO_REJECTED:
    "Продукт не прошёл автоматическую проверку безопасности. Подробности придут в уведомлении; при вопросах напишите в поддержку.",
  QUEUED: "Продукт отправлен на ручную проверку модератором.",
}

function StatusBanner({ status, reason }: { status: string; reason?: string | null }) {
  if (status === "PENDING") {
    return (
      <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        Продукт передан на проверку модератору. Обычно это занимает 1–2 рабочих дня.
      </div>
    )
  }
  if (status === "DRAFT") {
    return (
      <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        Черновик не опубликован. Нажмите «Отправить на проверку», чтобы передать продукт модератору.
      </div>
    )
  }
  if (status === "SCAN_FAILED") {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Автоматическое сканирование обнаружило потенциально опасный код. Свяжитесь с поддержкой для уточнения деталей.
      </div>
    )
  }
  if (status === "APPROVED") {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
        Продукт опубликован в каталоге и доступен для покупки.
      </div>
    )
  }
  if (status === "REJECTED") {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 space-y-1">
        <p className="text-sm font-medium text-destructive">Продукт отклонён модератором</p>
        {reason && <p className="text-sm text-muted-foreground">Причина: {reason}</p>}
        {!reason && <p className="text-sm text-muted-foreground">Причина не указана. Свяжитесь с поддержкой.</p>}
      </div>
    )
  }
  if (status === "SUSPENDED") {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 space-y-1">
        <p className="text-sm font-medium text-amber-400">Публикация приостановлена</p>
        {reason && <p className="text-sm text-muted-foreground">Причина: {reason}</p>}
        <p className="text-sm text-muted-foreground">Продукт скрыт из каталога. Для восстановления свяжитесь с поддержкой.</p>
      </div>
    )
  }
  return null
}

export default async function DeveloperProductPage({ params }: RouteParams) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params

  const product = await db.product.findUnique({
    where: { id },
    include: {
      files: true,
      moderationLogs: { orderBy: { createdAt: "desc" } },
      versions: { orderBy: { createdAt: "desc" } },
      _count: { select: { purchases: true, reviews: true } },
    },
  })

  if (!product) notFound()
  if (product.authorId !== session.user.id) redirect("/dashboard/products")

  // Reason from the last relevant log (rejection or suspension)
  const lastReasonLog = product.moderationLogs.find(
    (l) => l.action === "REJECTED" || l.action === "SUSPENDED",
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/dashboard/products" className="hover:underline">← Мои продукты</Link>
        </p>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold">{product.title}</h1>
          <Badge variant={STATUS_VARIANTS[product.status] ?? "outline"} className="shrink-0 mt-1">
            {STATUS_LABELS[product.status] ?? product.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {CATEGORY_LABELS[product.category as keyof typeof CATEGORY_LABELS]} · {formatPrice(product.price)} ·{" "}
          {product._count.purchases} продаж
        </p>
      </div>

      <StatusBanner status={product.status} reason={lastReasonLog?.comment} />

      {/* Description */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold">Описание</h2>
        <p className="text-sm text-muted-foreground">{product.shortDesc}</p>
        <p className="text-sm whitespace-pre-wrap">{product.fullDesc}</p>

        {(product.targetAudience || product.techStack.length > 0) && (
          <div className="grid grid-cols-2 gap-4 text-sm pt-2">
            {product.targetAudience && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Аудитория</p>
                <p>{product.targetAudience}</p>
              </div>
            )}
            {product.techStack.length > 0 && (
              <div>
                <p className="text-muted-foreground text-xs mb-1.5">Стек</p>
                <div className="flex flex-wrap gap-1">
                  {product.techStack.map(tag => (
                    <TechBadge key={tag} label={tag} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {product.features.length > 0 && (
          <div>
            <p className="text-muted-foreground text-xs mb-2">Функции</p>
            <ul className="space-y-1">
              {product.features.map((f, i) => (
                <li key={i} className="text-sm flex items-center gap-2">
                  <span className="text-primary">✓</span>{f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Files */}
      {product.files.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold">Файлы</h2>
          <ul className="space-y-2">
            {product.files.map((f) => (
              <li key={f.id} className="flex items-center justify-between text-sm">
                <span className="font-mono">{f.fileName}</span>
                <span className="text-muted-foreground">
                  {f.format} · {(f.fileSize / 1024).toFixed(1)} КБ · v{f.version}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Version history — only for approved products */}
      {product.status === "APPROVED" && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="font-semibold">Версии</h2>

          {product.versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Дополнительных версий нет. Покупателям доступен исходный файл, загруженный при публикации.
            </p>
          ) : (
            <ul className="space-y-3">
              {product.versions.map((v) => (
                <li key={v.id} className="flex items-start gap-3 text-sm border-b border-border last:border-0 pb-3 last:pb-0">
                  <div className="flex flex-col items-start gap-1 shrink-0 min-w-[90px]">
                    <span className="font-mono font-semibold text-primary">v{v.version}</span>
                    <Badge variant={VERSION_STATUS_VARIANTS[v.status] ?? "outline"} className="text-xs">
                      {VERSION_STATUS_LABELS[v.status] ?? v.status}
                    </Badge>
                    <VersionActions
                      productId={product.id}
                      versionId={v.id}
                      status={v.status}
                    />
                  </div>
                  <div className="flex-1 space-y-0.5 min-w-0">
                    {v.changelog && (
                      <p className="text-muted-foreground text-xs whitespace-pre-wrap break-words">{v.changelog}</p>
                    )}
                    {v.status === "REJECTED" && v.moderatorComment && (
                      <p className="text-xs text-destructive">
                        Причина отказа: {v.moderatorComment}
                      </p>
                    )}
                    {v.status === "PENDING" && (
                      <p className="text-xs text-muted-foreground">
                        Ожидает проверки. Покупатели получат доступ после одобрения.
                      </p>
                    )}
                    {v.status === "SUSPENDED" && (
                      <p className="text-xs text-muted-foreground">
                        Скрыта. Покупатели получают предыдущую версию или исходный файл.
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {v.createdAt.toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <NewVersionForm productId={product.id} />
        </section>
      )}

      {/* Moderation history */}
      {product.moderationLogs.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold">История проверок</h2>
          <ul className="space-y-3">
            {product.moderationLogs.map((log) => (
              <li key={log.id} className="text-sm flex items-start gap-3">
                <Badge variant="outline" className="shrink-0 mt-0.5">
                  {LOG_ACTION_LABELS[log.action] ?? log.action}
                </Badge>
                <div className="space-y-0.5">
                  {AUTO_LOG_MESSAGES[log.action] ? (
                    <p>{AUTO_LOG_MESSAGES[log.action]}</p>
                  ) : (
                    log.comment && <p>{log.comment}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {log.createdAt.toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Actions */}
      <ProductActions
        productId={product.id}
        productTitle={product.title}
        productStatus={product.status}
        productSlug={product.slug}
      />
    </div>
  )
}
