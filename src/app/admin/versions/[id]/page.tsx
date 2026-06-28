import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { db } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { CATEGORY_LABELS } from "@/types"
import { VersionModerationActions } from "./VersionModerationActions"
import type { Metadata } from "next"

type RouteParams = { params: Promise<{ id: string }> }

const VERSION_STATUS_LABEL: Record<string, string> = {
  PENDING:  "На проверке",
  APPROVED: "Одобрена",
  REJECTED: "Отклонена",
}
const VERSION_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING:  "default",
  APPROVED: "secondary",
  REJECTED: "destructive",
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { id } = await params
  const v = await db.productVersion.findUnique({
    where: { id },
    select: { version: true, product: { select: { title: true } } },
  })
  if (!v) return {}
  return { title: `v${v.version} — ${v.product.title}` }
}

export default async function AdminVersionReviewPage({ params }: RouteParams) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) redirect("/")

  const { id } = await params

  const version = await db.productVersion.findUnique({
    where: { id },
    include: {
      product: {
        select: {
          title: true,
          slug: true,
          category: true,
          author: { select: { name: true, email: true, telegramHandle: true } },
          versions: {
            where: { status: "APPROVED" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { version: true },
          },
        },
      },
    },
  })

  if (!version) notFound()

  const latestApproved = version.product.versions[0]

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <a href="/admin/queue" className="hover:underline">← Очередь</a>
        </p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{version.product.title}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {CATEGORY_LABELS[version.product.category as keyof typeof CATEGORY_LABELS]} ·{" "}
              Автор: {version.product.author.name ?? version.product.author.email}
            </p>
          </div>
          <Badge variant={VERSION_STATUS_VARIANT[version.status] ?? "outline"}>
            {VERSION_STATUS_LABEL[version.status] ?? version.status}
          </Badge>
        </div>
      </div>

      {/* Version info */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Версия</h2>
          <div className="flex items-center gap-3">
            {latestApproved && (
              <span className="text-xs text-muted-foreground">
                Текущая опубликованная: <span className="font-mono">v{latestApproved.version}</span>
              </span>
            )}
            <span className="font-mono text-lg font-bold text-primary">v{version.version}</span>
          </div>
        </div>

        {version.changelog ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Changelog</p>
            <p className="text-sm whitespace-pre-wrap bg-muted/30 rounded-md p-3">{version.changelog}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Changelog не указан.</p>
        )}
      </section>

      {/* File info */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h2 className="font-semibold">Файл</h2>
        {version.fileName ? (
          <div className="flex items-center justify-between text-sm">
            <span className="font-mono">{version.fileName}</span>
            <span className="text-muted-foreground">
              {version.fileSize > 0
                ? version.fileSize > 1024 * 1024
                  ? `${(version.fileSize / 1024 / 1024).toFixed(1)} МБ`
                  : `${(version.fileSize / 1024).toFixed(1)} КБ`
                : "Размер неизвестен"}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Файл не загружен (только метаданные).</p>
        )}
        {version.s3Key && (
          <p className="text-xs text-muted-foreground font-mono break-all">{version.s3Key}</p>
        )}
      </section>

      {/* Actions — only show if pending */}
      {version.status === "PENDING" ? (
        <VersionModerationActions versionId={version.id} />
      ) : (
        <section className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Эта версия уже рассмотрена:{" "}
            <span className="font-medium text-foreground">
              {VERSION_STATUS_LABEL[version.status] ?? version.status}
            </span>
            {version.moderatorComment && (
              <span> — {version.moderatorComment}</span>
            )}
          </p>
        </section>
      )}
    </div>
  )
}
