"use client"

import { useEffect, useId, useRef, useState } from "react"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { LogOut, LayoutDashboard, ShieldCheck, ListChecks, Package, MessageCircle, Inbox, Settings, Upload, Store, Mail, ChevronDown, ShoppingBag, History } from "lucide-react"
import { canManageCode } from "@/lib/permissions"

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
  const menuRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); toggleRef.current?.focus() }
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

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

  const homeHref = "/dashboard"
  const homeLabel = "Кабинет"

  return (
    <div
      ref={menuRef}
      className="relative flex items-center"
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
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
      <button ref={toggleRef} type="button" aria-label="Меню аккаунта" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((value) => !value)} className="flex h-10 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"><ChevronDown aria-hidden="true" className="h-4 w-4" /></button>

      {open && (
        <div id={menuId} className="absolute right-0 top-full pt-1 z-50">
          <div className="min-w-[180px] rounded-md border border-border bg-popover shadow-lg py-1">
            {canManageCode(role) && (
              <Link
                href="/submit"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-violet hover:bg-accent transition-colors"
                onClick={() => setOpen(false)}
              >
                <Upload className="h-4 w-4" />
                Загрузить продукт
              </Link>
            )}

            {!isMod(role) && role !== "DEVELOPER" && (
              <Link
                href="/sell"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-violet hover:bg-accent transition-colors"
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

            <Link href="/dashboard/orders" className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent" onClick={() => setOpen(false)}><ListChecks className="h-4 w-4 text-muted-foreground" />Мои заказы и отклики</Link>
            <Link
              href={messagesHref}
              aria-label="Сообщения по покупкам"
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={() => setOpen(false)}
            >
              <span className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Сообщения
              </span>
              {/* кружок-счётчик (0 — не показываем; цвет временный — bg-red-500) */}
              {count > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold leading-none text-white">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>

            <Link href="/purchases" className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent" onClick={() => setOpen(false)}><ShoppingBag aria-hidden="true" className="h-4 w-4 text-muted-foreground" />Мои покупки</Link>
            <Link href="/services#my-orders" className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent" onClick={() => setOpen(false)}><History aria-hidden="true" className="h-4 w-4 text-muted-foreground" />Мои услуги</Link>
            {canManageCode(role) && <Link href="/dashboard/profile" className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent" onClick={() => setOpen(false)}><Store aria-hidden="true" className="h-4 w-4 text-muted-foreground" />Профиль разработчика</Link>}
            {isMod(role) && <Link href="/admin" className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent" onClick={() => setOpen(false)}><ShieldCheck aria-hidden="true" className="h-4 w-4 text-muted-foreground" />Рабочий стол</Link>}

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

            {canManageCode(role) && (
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
