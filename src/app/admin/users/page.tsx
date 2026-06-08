import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { BanButton, UnbanButton } from "./UserBanActions"
import Link from "next/link"

export const metadata = { title: "Пользователи — ПОЛКА" }

const ROLE_LABELS: Record<string, string> = {
  BUYER: "Покупатель",
  DEVELOPER: "Разработчик",
  MODERATOR: "Модератор",
  ADMIN: "Администратор",
}
const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  BUYER: "outline",
  DEVELOPER: "secondary",
  MODERATOR: "default",
  ADMIN: "default",
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || user.role !== "ADMIN") redirect("/")

  const { q = "", page: pageStr = "1" } = await searchParams
  const page = Math.max(1, parseInt(pageStr))
  const take = 50
  const skip = (page - 1) * take

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
          { telegramHandle: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {}

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      select: {
        id: true,
        email: true,
        name: true,
        telegramHandle: true,
        role: true,
        isBanned: true,
        bannedAt: true,
        banReason: true,
        createdAt: true,
        _count: { select: { products: true, purchases: true } },
      },
    }),
    db.user.count({ where }),
  ])

  const pages = Math.ceil(total / take)

  function pageUrl(p: number) {
    const sp = new URLSearchParams()
    if (q) sp.set("q", q)
    if (p > 1) sp.set("page", String(p))
    const str = sp.toString()
    return `/admin/users${str ? `?${str}` : ""}`
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            <a href="/admin" className="hover:underline">← Рабочий стол</a>
          </p>
          <h1 className="text-2xl font-semibold">Пользователи</h1>
        </div>
        <span className="text-sm text-muted-foreground">{total} всего</span>
      </div>

      {/* Search */}
      <form method="GET" className="flex gap-2 max-w-sm">
        <input
          name="q"
          defaultValue={q}
          placeholder="Email, имя или Telegram…"
          className="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <button
          type="submit"
          className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          Найти
        </button>
        {q && (
          <a
            href="/admin/users"
            className="h-9 px-3 flex items-center rounded-md border border-input text-sm text-muted-foreground hover:bg-muted"
          >
            ✕
          </a>
        )}
      </form>

      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Пользователи не найдены.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Пользователь</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Роль</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Продукты</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Покупки</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Статус</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Зарегистрирован</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className={u.isBanned ? "bg-destructive/5" : "hover:bg-muted/20"}>
                  <td className="px-4 py-3">
                    <p className="font-medium truncate max-w-[200px]">{u.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {u.email ?? (u.telegramHandle ? `@${u.telegramHandle}` : "—")}
                    </p>
                    {u.isBanned && u.banReason && (
                      <p className="text-xs text-destructive mt-0.5 truncate max-w-[200px]" title={u.banReason}>
                        {u.banReason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={ROLE_VARIANTS[u.role] ?? "outline"} className="text-xs">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{u._count.products}</td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{u._count.purchases}</td>
                  <td className="px-4 py-3">
                    {u.isBanned ? (
                      <Badge variant="destructive" className="text-xs">
                        Заблокирован
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Активен
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs tabular-nums whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="px-4 py-3">
                    {u.role !== "ADMIN" && (
                      u.isBanned
                        ? <UnbanButton id={u.id} />
                        : <BanButton id={u.id} name={u.name} />
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
              href={pageUrl(page - 1)}
              className="h-8 px-3 flex items-center rounded-md border border-input text-sm hover:bg-muted"
            >
              ← Назад
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            Страница {page} из {pages}
          </span>
          {page < pages && (
            <Link
              href={pageUrl(page + 1)}
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
