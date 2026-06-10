"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Mail } from "lucide-react"

interface MessageBellProps {
  initialCount: number
  href: string
}

const POLL_MS = 30_000

export function MessageBell({ initialCount, href }: MessageBellProps) {
  const [count, setCount] = useState(initialCount)

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

  return (
    <Link
      href={href}
      title="Сообщения"
      className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
    >
      <Mail className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  )
}
