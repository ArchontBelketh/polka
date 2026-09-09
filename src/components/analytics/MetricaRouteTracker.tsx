"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

declare global {
  interface Window {
    ym?: (id: number, action: string, ...args: unknown[]) => void
  }
}

// В Next (клиентская навигация) обычная вставка Метрики засчитывает только
// первый заход. На каждый переход между страницами шлём ym(id, 'hit', url).
export function MetricaRouteTracker({ id }: { id: number }) {
  const pathname = usePathname()
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false // первый просмотр уже засчитан в init
      return
    }
    window.ym?.(id, "hit", window.location.href)
  }, [pathname, id])

  return null
}
