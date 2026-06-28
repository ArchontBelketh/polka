"use client"

import { useEffect, useRef, useState } from "react"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { LogOut, LayoutDashboard, ShieldCheck, ListChecks, Package, MessageCircle, Inbox, Settings, Upload, Store, Mail } from "lucide-react"

interface UserMenuProps {
  role?: string
  /** начальное число непрочитанных сообщений (приходит из серверного Navbar) */
  unread?: number
  /** ссылка на переписки (зависит от роли) */
  messagesHref?: string
}

const isMod = (role?: string) => role === "MODERATOR" || role === "ADMIN"
const POLL_MS = 30_000

export function UserMenu({ role, unread = 0, messagesHref = "/purchases" }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(unread)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Живой счётчик непрочитанных (как раньше в MessageBell).
  useEffect(() => {
    let active = true
    async function poll() {
      try {
        const res = await fetch("/api/messages/unread", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (active && typeof data.count === "number") setCount(data.count)
      } catch {
        // ignore
      }
    }
    const t = setInterval(poll, POLL_MS)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [])

  function handleMouseEnter() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }

  function handleMouseLeave() {
    closeTimer.current = setTimeout(() => setOpen(false), 150)
  }

  const homeHref = isMod(role) ? "/admin" : "/dashboard"
  const homeLabel = isMod(role) ? "Рабочий стол" : "Кабинет"

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link
        href={homeHref}
        className="relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        {isMod(role) ? (
          <ShieldCheck className="h-4 w-4" />
        ) : (
          <LayoutDashboard className="h-4 w-4" />
        )}
        {homeLabel}
        {/* индикатор непрочитанных (цвет временный — bg-red-500) */}
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500" />
        )}
      </Link>

      {open && (
        <div className="absolute right-0 top-full pt-1 z-50">
          <div className="min-w-[180px] rounded-md border border-border bg-popover shadow-lg py-1">
            {role === "DEVELOPER" && (
              <Link
                href="/submit"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-deep hover:bg-accent transition-colors"
                onClick={() => setOpen(false)}
              >
                <Upload className="h-4 w-4" />
                Загрузить продукт
              </Link>
            )}

            {!isMod(role) && role !== "DEVELOPER" && (
              <Link
                href="/sell"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-deep hover:bg-accent transition-colors"
                onClick={() => setOpen(false)}
              >
                <Store className="h-4 w-4" />
                Продавать
              </Link>
            )}

            {!isMod(role) && <div className="my-1 border-t border-border" />}

            <Link
              href={homeHref}
              className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={() => setOpen(false)}
            >
              {isMod(role) ? (
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              ) : (
                <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
              )}
              {homeLabel}
            </Link>

            <Link
              href={messagesHref}
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={() => setOpen(false)}
            >
              <span className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Сообщения
              </span>
              {/* кружок-счётчик (0 — не показываем; цвет временный — bg-red-500) */}
              {count > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold leading-none text-white">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>

            {isMod(role) && (
              <Link
                href="/admin/queue"
                className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => setOpen(false)}
              >
                <ListChecks className="h-4 w-4 text-muted-foreground" />
                Очередь модерации
              </Link>
            )}

            {isMod(role) && (
              <Link
                href="/admin/support"
                className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => setOpen(false)}
              >
                <Inbox className="h-4 w-4 text-muted-foreground" />
                Обращения
              </Link>
            )}

            {role === "DEVELOPER" && (
              <Link
                href="/dashboard/products"
                className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => setOpen(false)}
              >
                <Package className="h-4 w-4 text-muted-foreground" />
                Мои продукты
              </Link>
            )}

            {!isMod(role) && (
              <Link
                href="/support"
                className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => setOpen(false)}
              >
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                Мои обращения
              </Link>
            )}

            <Link
              href="/settings"
              className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={() => setOpen(false)}
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              Настройки
            </Link>

            <div className="my-1 border-t border-border" />

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Выход
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
