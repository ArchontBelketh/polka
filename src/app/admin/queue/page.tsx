import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/utils"
import { CATEGORY_LABELS } from "@/types"

export const metadata = { title: "Очередь модерации — ПОЛКА" }

const STATUS_LABELS: Record<string, string> = {
  PENDING: "На проверке",
  SCAN_FAILED: "Отклонён сканером",
  DRAFT: "Черновик",
}
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
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

  const products = await db.product.findMany({
    where: { status: { in: ["PENDING", "SCAN_FAILED"] } },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { name: true, email: true } },
      scanResult: { select: { status: true, findings: true, toolsRun: true } },
      files: { select: { id: true, fileName: true, format: true } },
    },
  })

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Очередь модерации</h1>
        <span className="text-sm text-muted-foreground">{products.length} продуктов</span>
      </div>

      {products.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          Очередь пуста — все продукты проверены.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Продукт</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Категория</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Автор</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Статус</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Цена</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((p) => {
                const findings = (p.scanResult?.findings ?? []) as Array<{ severity: string }>
                const critCount = findings.filter((f) => f.severity === "critical").length
                const warnCount = findings.filter((f) => f.severity === "warning").length

                return (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.title}</p>
                      {(critCount > 0 || warnCount > 0) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {critCount > 0 && <span className="text-red-400">{critCount} критических </span>}
                          {warnCount > 0 && <span className="text-yellow-400">{warnCount} предупреждений</span>}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                      {CATEGORY_LABELS[p.category as keyof typeof CATEGORY_LABELS]}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {p.author.name ?? p.author.email ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANTS[p.status] ?? "outline"}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
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
    </div>
  )
}
