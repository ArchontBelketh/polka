import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ProfileForm } from "./ProfileForm"
import { PasswordForm } from "./PasswordForm"
import { formatPrice } from "@/lib/utils"
import { ExternalLink } from "lucide-react"

export const metadata = { title: "Настройки" }

const ROLE_LABELS: Record<string, string> = {
  BUYER:     "Покупатель",
  DEVELOPER: "Разработчик",
  MODERATOR: "Модератор",
  ADMIN:     "Администратор",
}
const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  BUYER:     "outline",
  DEVELOPER: "secondary",
  MODERATOR: "default",
  ADMIN:     "default",
}

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id:             true,
      name:           true,
      email:          true,
      telegramHandle: true,
      telegramId:     true,
      phone:          true,
      bio:            true,
      role:           true,
      passwordHash:   true,
      balance:        true,
      createdAt:      true,
      _count: {
        select: {
          purchases: true,
          products:  true,
          wishlists: true,
        },
      },
    },
  })

  if (!user) redirect("/login")

  const isDeveloper = user.role === "DEVELOPER" || user.role === "ADMIN"
  const isMod       = user.role === "MODERATOR"  || user.role === "ADMIN"
  const hasPassword = !!user.passwordHash

  // Extra stats for developers
  let devStats: { totalSales: number; approvedCount: number } | null = null
  if (isDeveloper) {
    const [totalSales, approvedCount] = await Promise.all([
      db.purchase.count({
        where: {
          product: { authorId: user.id },
          status: { in: ["PAID", "DELIVERED"] },
        },
      }),
      db.product.count({ where: { authorId: user.id, status: "APPROVED" } }),
    ])
    devStats = { totalSales, approvedCount }
  }

  const initials = (user.name ?? user.email ?? "?")[0].toUpperCase()

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
      {/* Profile header */}
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground shrink-0">
          {initials}
        </div>
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold truncate">{user.name ?? "Пользователь"}</h1>
            <Badge variant={ROLE_VARIANTS[user.role] ?? "outline"} className="text-xs">
              {ROLE_LABELS[user.role] ?? user.role}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {user.email ?? (user.telegramHandle ? `@${user.telegramHandle}` : "Без email")}
          </p>
          <p className="text-xs text-muted-foreground">
            На платформе с {new Date(user.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Role-specific stats */}
      {!isMod && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {isDeveloper && devStats && (
            <>
              <StatTile label="Продажи" value={String(devStats.totalSales)} />
              <StatTile label="Продуктов" value={String(devStats.approvedCount)} />
              <StatTile label="Баланс" value={formatPrice(user.balance)} />
            </>
          )}
          <StatTile label="Покупок" value={String(user._count.purchases)} />
          {!isDeveloper && (
            <StatTile label="В избранном" value={String(user._count.wishlists)} />
          )}
        </div>
      )}

      {/* Developer public profile link */}
      {isDeveloper && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
          <div>
            <p className="text-sm font-medium">Публичный профиль</p>
            <p className="text-xs text-muted-foreground mt-0.5">Виден всем пользователям платформы</p>
          </div>
          <Link
            href={`/developer/${user.id}`}
            target="_blank"
            className="flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-4"
          >
            Открыть <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Personal info */}
      <section className="space-y-4">
        <div>
          <h2 className="font-semibold">Личные данные</h2>
          {user.email && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Email: <span className="font-mono">{user.email}</span> — не редактируется
            </p>
          )}
          {user.telegramId && !user.email && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Вход через Telegram ID <span className="font-mono">{user.telegramId}</span>
            </p>
          )}
        </div>
        <ProfileForm
          name={user.name}
          telegramHandle={user.telegramHandle}
          phone={user.phone}
          bio={user.bio}
          isDeveloper={isDeveloper}
        />
      </section>

      {/* Password change — only for credentials users */}
      {hasPassword && (
        <section className="space-y-4">
          <h2 className="font-semibold">Смена пароля</h2>
          <PasswordForm />
        </section>
      )}

      {/* Quick links */}
      <section className="space-y-2">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Разделы</h2>
        <div className="flex flex-wrap gap-2">
          {isDeveloper && (
            <>
              <QuickLink href="/dashboard">Кабинет разработчика</QuickLink>
              <QuickLink href="/dashboard/products">Мои продукты</QuickLink>
              <QuickLink href="/dashboard/payouts">Выплаты</QuickLink>
            </>
          )}
          {!isMod && (
            <>
              <QuickLink href="/purchases">Мои покупки</QuickLink>
              <QuickLink href="/purchases?tab=wishlist">Понравившееся</QuickLink>
            </>
          )}
          <QuickLink href="/support">Мои обращения</QuickLink>
          {isMod && <QuickLink href="/admin">Рабочий стол</QuickLink>}
        </div>
      </section>

      {/* Account meta */}
      <section className="rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-1">
        <p className="text-xs text-muted-foreground">
          ID аккаунта: <span className="font-mono">{user.id}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Зарегистрирован: {new Date(user.createdAt).toLocaleString("ru-RU")}
        </p>
        <p className="text-xs text-muted-foreground">
          Вход через: {user.telegramId ? "Telegram" : "Email и пароль"}
        </p>
      </section>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function QuickLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
    >
      {children}
    </Link>
  )
}
