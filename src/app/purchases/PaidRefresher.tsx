"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

/**
 * После возврата с оплаты статус меняет асинхронный вебхук Т-Банка, поэтому в
 * момент редиректа покупка ещё PENDING. Пока это так — мягко обновляем страницу
 * (router.refresh перечитывает серверный компонент) несколько раз, чтобы статус
 * подхватился без ручного F5. Как только pending=false — опрос прекращается.
 */
export function PaidRefresher({ pending }: { pending: boolean }) {
  const router = useRouter()
  const tries = useRef(0)

  useEffect(() => {
    if (!pending) return
    const t = setInterval(() => {
      tries.current += 1
      router.refresh()
      if (tries.current >= 10) clearInterval(t) // ~20 c и стоп
    }, 2000)
    return () => clearInterval(t)
  }, [pending, router])

  return null
}
