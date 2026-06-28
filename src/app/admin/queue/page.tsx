import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/utils"
import { CATEGORY_LABELS } from "@/types"

export const metadata = { title: "Очередь модерации" }

const PRODUCT_STATUS_LABELS: Record<string, string> = {
  PENDING: "На проверке",
  SCAN_FAILED: "Отклонён сканером",
  DRAFT: "Черновик",
}
const PRODUCT_STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "default",
  SCAN_FAILED: "destructive",
  DRAFT: "secondary",
}

export default async function AdminQueuePage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) {
    redirect("/")
  }

  const [products, pendingVersions] = await Promise.all([
    db.product.findMany({
      where: { status: { in: ["PENDING", "SCAN_FAILED"] } },
      orderBy: [{ riskScore: "desc" }, { createdAt: "asc" }],
      include: {
        author: { select: { name: true, email: true } },
        scanResult: { select: { status: true, findings: true, toolsRun: true } },
        files: { select: { id: true, fileName: true, format: true } },
      },
    }),
    db.productVersion.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        product: {
          select: {
            title: true,
            category: true,
            author: { select: { name: true, email: true } },
          },
        },
      },
    }),
  ])

  const totalPending = products.length + pendingVersions.length

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Очередь модерации</h1>
        <span className="text-sm text-muted-foreground">{totalPending} ожидает</span>
      </div>

      {/* ─── Pending versions ─────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          Обновления продуктов
          {pendingVersions.length > 0 && (
            <Badge variant="default">{pendingVersions.length}</Badge>
          )}
        </h2>

        {pendingVersions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center border border-border rounded-lg">
            Нет версий на рассмотрении.
          </p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Продукт</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Версия</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Автор</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Файл</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingVersions.map((v) => (
                  <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{v.product.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {CATEGORY_LABELS[v.product.category as keyof typeof CATEGORY_LABELS]}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-primary">v{v.version}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {v.product.author.name ?? v.product.author.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground font-mono text-xs">
                      {v.fileName || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/versions/${v.id}`}
                        className="text-primary hover:underline underline-offset-4"
                      >
                        Проверить →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── Pending products ─────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          Новые продукты
          {products.length > 0 && (
            <Badge variant="outline">{products.length}</Badge>
          )}
        </h2>

        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center border border-border rounded-lg">
            Нет продуктов на рассмотрении.
          </p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Продукт</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Категория</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Автор</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Статус</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground hidden sm:table-cell">Risk</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Цена</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => {
                  const findings = (p.scanResult?.findings ?? []) as Array<{ severity: string }>
                  const critCount = findings.filter((f) => f.severity === "critical").length
                  const warnCount = findings.filter((f) => f.severity === "warning").length

                  const riskScore = (p as typeof p & { riskScore?: number | null }).riskScore
                  const autoDecision = (p as typeof p & { autoDecision?: string | null }).autoDecision
                  const riskColor =
                    riskScore == null ? "text-muted-foreground" :
                    riskScore > 60 ? "text-red-400 font-bold" :
                    riskScore > 20 ? "text-yellow-400 font-semibold" :
                    "text-green-400"

                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {critCount > 0 && <span className="text-red-400">{critCount} критических </span>}
                          {warnCount > 0 && <span className="text-yellow-400">{warnCount} предупреждений</span>}
                          {autoDecision && (
                            <span className="ml-1 opacity-60">· {autoDecision.replace("_", " ")}</span>
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                        {CATEGORY_LABELS[p.category as keyof typeof CATEGORY_LABELS]}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                        {p.author.name ?? p.author.email ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={PRODUCT_STATUS_VARIANTS[p.status] ?? "outline"}>
                          {PRODUCT_STATUS_LABELS[p.status] ?? p.status}
                        </Badge>
                      </td>
                      <td className={`px-4 py-3 text-center hidden sm:table-cell tabular-nums text-sm ${riskColor}`}>
                        {riskScore ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right">{formatPrice(p.price)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/review/${p.id}`}
                          className="text-primary hover:underline underline-offset-4"
                        >
                          Проверить →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
