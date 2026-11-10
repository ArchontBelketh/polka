"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { Menu, X, Search, LogIn } from "lucide-react"
import { TRACE_PATHS, NODES, HOT_NODES } from "./headerTraces"
import { useTraceScale } from "./useTraceScale"
import { useSparks } from "./useSparks"
import { UserMenu } from "@/components/layout/UserMenu"
import { Brand } from "@/components/layout/Brand"
import { Button } from "@/components/ui/button"
import { PRIMARY_NAVIGATION, isNavigationActive } from "@/lib/navigation"
import { cn } from "@/lib/utils"

interface CyberHeaderProps {
  authed: boolean
  role?: string
  unread: number
  messagesHref: string
}

const navLink = "rounded-lg px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"

function CatalogSearch({ mobile = false }: { mobile?: boolean }) {
  return (
    <form action="/catalog" method="get" role="search" aria-label="Поиск готового кода" className={cn("items-center gap-2 rounded-xl border border-border bg-background/90 pl-3 focus-within:border-violet", mobile ? "mb-3 flex w-full" : "hidden w-52 shrink-0 xl:flex")}>
      <input aria-label="Что ищем в каталоге?" name="q" type="search" placeholder="Найти готовый код" className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
      <button type="submit" aria-label="Найти в каталоге" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-violet transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan">
        <Search className="h-4 w-4" />
      </button>
    </form>
  )
}

export default function CyberHeader({ authed, role, unread, messagesHref }: CyberHeaderProps) {
  const pathname = usePathname()
  const rootRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const traceGroupRef = useRef<SVGGElement>(null)
  const sparkGroupRef = useRef<SVGGElement>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  useTraceScale(headerRef, headerRef)
  useSparks(headerRef, traceGroupRef, sparkGroupRef)

  useEffect(() => {
    if (!mobileOpen) return
    const close = () => setMobileOpen(false)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { close(); toggleRef.current?.focus() }
    }
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) close()
    }
    const wide = window.matchMedia("(min-width: 1024px)")
    const onResize = () => { if (wide.matches) close() }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onPointer)
    window.addEventListener("popstate", close)
    wide.addEventListener("change", onResize)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onPointer)
      window.removeEventListener("popstate", close)
      wide.removeEventListener("change", onResize)
    }
  }, [mobileOpen])

  const closeMobile = () => setMobileOpen(false)
  const isMod = role === "MODERATOR" || role === "ADMIN"

  return (
    <header ref={rootRef} className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-xl">
      <div ref={headerRef} className="relative">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden overflow-hidden opacity-20 lg:block">
          <svg viewBox="0 0 2899 84" width="2899" height="84" fill="none" className="absolute left-1/2 top-1/2" style={{ transform: "translate(-50%,-50%) scale(var(--s,1))" }}>
            <defs>
              <linearGradient id="traceGrad" x1="0" y1="0" x2="760" y2="0" gradientUnits="userSpaceOnUse" spreadMethod="repeat">
                <stop offset="0" stopColor="#34E6E0" /><stop offset="0.5" stopColor="#9D8CFF" /><stop offset="1" stopColor="#34E6E0" />
              </linearGradient>
            </defs>
            <g ref={traceGroupRef} className="trace-glow" stroke="url(#traceGrad)" strokeWidth="2" strokeLinecap="round" fill="none">
              {TRACE_PATHS.map((d, i) => <path key={i} d={d} />)}
            </g>
            <g stroke="#34E6E0" fill="#110f1c">
              {NODES.map((n, i) => <circle key={i} cx={n.cx} cy={n.cy} r={n.r} />)}
            </g>
            <g fill="currentColor">
              {HOT_NODES.map((n, i) => <circle key={i} className="hot" cx={n.cx} cy={n.cy} r={n.r} style={{ color: n.color, animationDelay: n.delay }} />)}
            </g>
            <g ref={sparkGroupRef} fill="none" />
          </svg>
        </div>

        <div className="relative mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:gap-5">
          <Link href="/" aria-label="CYBERПОЛКА — на главную" onNavigate={closeMobile} className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"><Brand /></Link>
          <nav aria-label="Основная навигация" className="hidden items-center gap-0.5 lg:flex">
            {PRIMARY_NAVIGATION.map((link) => <Link key={link.href} href={link.href} aria-current={isNavigationActive(pathname, link.href) ? "page" : undefined} className={cn(navLink, isNavigationActive(pathname, link.href) && "bg-accent text-cyan")}>{link.label}</Link>)}
          </nav>
          <div className="ml-auto hidden items-center gap-3 lg:flex">
            <CatalogSearch />
            {authed ? <UserMenu role={role} unread={unread} messagesHref={messagesHref} /> : <Button asChild variant="outline" size="sm"><Link href="/login"><LogIn aria-hidden="true" />Войти</Link></Button>}
          </div>
          <button ref={toggleRef} type="button" onClick={() => setMobileOpen((open) => !open)} aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"} aria-expanded={mobileOpen} aria-controls="mobile-navigation" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan lg:hidden">
            {mobileOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && <nav id="mobile-navigation" aria-label="Мобильная навигация" className="max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain border-t border-border bg-background px-4 pb-5 pt-4 lg:hidden">
        <CatalogSearch mobile />
        <div className="grid gap-1">
          {PRIMARY_NAVIGATION.map((link) => <Link key={link.href} href={link.href} onNavigate={closeMobile} onClick={closeMobile} aria-current={isNavigationActive(pathname, link.href) ? "page" : undefined} className={cn(navLink, "py-3", isNavigationActive(pathname, link.href) && "bg-accent text-cyan")}>{link.label}</Link>)}
          <Link href="/support" className={navLink} onClick={closeMobile}>Помощь</Link>
        </div>
        <div className="mt-3 grid gap-1 border-t border-border pt-3">
          {authed ? <>
            <Link href="/dashboard" className={navLink} onClick={closeMobile}>Кабинет</Link>
            {isMod && <Link href="/admin" className={navLink} onClick={closeMobile}>Рабочий стол</Link>}
            <Link href="/purchases" className={navLink} onClick={closeMobile}>Мои покупки</Link>
            <Link href="/dashboard/orders" className={navLink} onClick={closeMobile}>Мои заказы и отклики</Link>
            <Link href={messagesHref} className={navLink} onClick={closeMobile}>Сообщения{unread > 0 ? ` (${unread})` : ""}</Link>
            <Link href="/services#my-orders" className={navLink} onClick={closeMobile}>Мои услуги</Link>
            {(role === "DEVELOPER" || role === "ADMIN") && <Link href="/dashboard/profile" className={navLink} onClick={closeMobile}>Профиль разработчика</Link>}
            {role === "DEVELOPER" && <Link href="/submit" className={navLink} onClick={closeMobile}>Разместить код</Link>}
            <Link href="/settings" className={navLink} onClick={closeMobile}>Настройки</Link>
            <button type="button" className={cn(navLink, "text-left text-red-400")} onClick={() => signOut({ callbackUrl: "/login" })}>Выйти</button>
          </> : <>
            <Button asChild className="mt-1 w-full"><Link href="/login" onClick={closeMobile}>Войти</Link></Button>
            <Link href="/register" onClick={closeMobile} className={cn(navLink, "text-center")}>Создать аккаунт</Link>
          </>}
        </div>
      </nav>}
    </header>
  )
}
