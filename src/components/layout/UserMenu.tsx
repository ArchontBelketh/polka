"use client"

import { useRef, useState } from "react"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { LogOut, LayoutDashboard, ShieldCheck, ListChecks, Package } from "lucide-react"

interface UserMenuProps {
  role?: string
}

const isMod = (role?: string) => role === "MODERATOR" || role === "ADMIN"

export function UserMenu({ role }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        {isMod(role) ? (
          <ShieldCheck className="h-4 w-4" />
        ) : (
          <LayoutDashboard className="h-4 w-4" />
        )}
        {homeLabel}
      </Link>

      {open && (
        <div className="absolute right-0 top-full pt-1 z-50">
          <div className="min-w-[180px] rounded-md border border-border bg-popover shadow-lg py-1">
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

            <div className="my-1 border-t border-border" />

            <button
              onClick={() => signOut({ callbackUrl: "/catalog" })}
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
