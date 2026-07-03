import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Prisma } from "@/generated/prisma/client"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/utils"
import { CATEGORY_LABELS } from "@/types"
import { SuspendButton, RestoreButton } from "./ProductModerationActions"

export const metadata = { title: "Продукты" }

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  PENDING: "На проверке",
  SCAN_FAILED: "Отклонён сканером",
  APPROVED: "Опубликован",
  REJECTED: "Отклонён",
  SUSPENDED: "Снят",
}
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  PENDING: "default",
  SCAN_FAILED: "destructive",
  APPROVED: "outline",
  REJECTED: "destructive",
  SUSPENDED: "destructive",
}

// Фильтры-вкладки по статусу
const STATUS_FILTERS = ["ALL", "APPROVED", "SUSPENDED", "PENDING", "SCAN_FAILED", "REJECTED", "DRAFT"] as const
const FILTER_LABELS: Record<(typeof STATUS_FILTERS)[number], string> = {
  ALL: "Все",
  APPROVED: "Опубликованы",
  SUSPENDED: "Сняты",
  PENDING: "На проверке",
  SCAN_FAILED: "Отклонены сканером",
  REJECTED: "Отклонены",
  DRAFT: "Черновики",
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) redirect("/")

  const { q = "", status = "ALL", page: pageStr = "1" } = await searchParams
  const statusFilter = (STATUS_FILTERS as readonly string[]).includes(status) ? status : "ALL"
  const page = Math.max(1, parseInt(pageStr) || 1)
  const take = 50
  const skip = (page - 1) * take

  const where: Prisma.ProductWhereInput = {}
  if (q) where.title = { contains: q, mode: "insensitive" }
  if (statusFilter !== "ALL") where.status = statusFilter as Prisma.ProductWhereInput["status"]

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        category: true,
        price: true,
        salesCount: true,
        author: { select: { name: true, email: true } },
      },
    }),
    db.product.count({ where }),
  ])

  const pages = Math.ceil(total / take)

  function buildUrl(params: { status?: string; page?: number }) {
    const sp = new URLSearchParams()
    if (q) sp.set("q", q)
    const st = params.status ?? statusFilter
    if (st !== "ALL") sp.set("status", st)
    const p = params.page ?? 1
    if (p > 1) sp.set("page", String(p))
    const str = sp.toString()
    return `/admin/products${str ? `?${str}` : ""}`
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            <a href="/admin" className="hover:underline">← Рабочий стол</a>
          </p>
          <h1 className="text-2xl font-semibold">Продукты</h1>
        </div>
        <span className="text-sm text-muted-foreground">{total} всего</span>
      </div>

      {/* Search */}
      <form method="GET" className="flex gap-2 max-w-sm">
        <input
          name="q"
          defaultValue={q}
          placeholder="Название продукта…"
          className="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        {statusFilter !== "ALL" && <input type="hidden" name="status" value={statusFilter} />}
        <button
          type="submit"
          className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          Найти
        </button>
        {q && (
          <a
            href={buildUrl({ page: 1 })}
            className="h-9 px-3 flex items-center rounded-md border border-input text-sm text-muted-foreground hover:bg-muted"
          >
            ✕
          </a>
        )}
      </form>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f}
            href={buildUrl({ status: f, page: 1 })}
            className={`h-8 px-3 flex items-center rounded-md border text-sm transition-colors ${
              statusFilter === f
                ? "border-primary bg-primary/10 text-primary font-medium"
                : "border-input text-muted-foreground hover:bg-muted"
            }`}
          >
            {FILTER_LABELS[f]}
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Продукты не найдены.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Продукт</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Автор</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Статус</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Продаж</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Цена</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((p) => (
                <tr key={p.id} className={p.status === "SUSPENDED" ? "bg-destructive/5" : "hover:bg-muted/20"}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/review/${p.id}`}
                      className="font-medium hover:underline underline-offset-4 truncate block max-w-[280px]"
                    >
                      {p.title}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {CATEGORY_LABELS[p.category as keyof typeof CATEGORY_LABELS]}
                    </p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground truncate max-w-[180px]">
                    {p.author.name ?? p.author.email ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[p.status] ?? "outline"} className="text-xs">
                      {STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell text-muted-foreground tabular-nums">
                    {p.salesCount}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatPrice(p.price)}</td>
                  <td className="px-4 py-3 text-right">
                    {p.status === "APPROVED" && <SuspendButton id={p.id} />}
                    {p.status === "SUSPENDED" && <RestoreButton id={p.id} />}
                    {p.status !== "APPROVED" && p.status !== "SUSPENDED" && (
                      <Link
                        href={`/admin/review/${p.id}`}
                        className="text-primary hover:underline underline-offset-4 text-sm"
                      >
                        Открыть →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex gap-2 items-center justify-center">
          {page > 1 && (
            <Link
              href={buildUrl({ page: page - 1 })}
              className="h-8 px-3 flex items-center rounded-md border border-input text-sm hover:bg-muted"
            >
              ← Назад
            </Link>
          )}
          <span className="text-sm text-muted-foreground">Страница {page} из {pages}</span>
          {page < pages && (
            <Link
              href={buildUrl({ page: page + 1 })}
              className="h-8 px-3 flex items-center rounded-md border border-input text-sm hover:bg-muted"
            >
              Вперёд →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
