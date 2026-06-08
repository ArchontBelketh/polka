"use client"

import { useRef, useState } from "react"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { LogOut, LayoutDashboard } from "lucide-react"

interface UserMenuProps {
  role?: string
}

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

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <LayoutDashboard className="h-4 w-4" />
        Кабинет
      </Link>

      {open && (
        <div className="absolute right-0 top-full pt-1 z-50">
          <div className="min-w-[160px] rounded-md border border-border bg-popover shadow-lg py-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={() => setOpen(false)}
            >
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
              Кабинет
            </Link>

            {role === "DEVELOPER" && (
              <Link
                href="/dashboard/products"
                className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => setOpen(false)}
              >
                <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
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
