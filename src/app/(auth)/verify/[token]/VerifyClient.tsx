"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

type State = "loading" | "ok" | "error"

export function VerifyClient({ token }: { token: string }) {
  const [state, setState] = useState<State>("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        })
        const data = await res.json().catch(() => ({}))
        if (!active) return
        if (res.ok) {
          setState("ok")
        } else {
          setState("error")
          setMessage(typeof data.error === "string" ? data.error : "Не удалось подтвердить email")
        }
      } catch {
        if (active) { setState("error"); setMessage("Ошибка соединения") }
      }
    })()
    return () => { active = false }
  }, [token])

  if (state === "loading") {
    return <p className="text-sm text-muted-foreground">Подтверждаем…</p>
  }

  if (state === "ok") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          ✓ Email подтверждён. Теперь вы можете оставлять отзывы и задавать вопросы.
        </div>
        <Button asChild className="w-full">
          <Link href="/catalog">В каталог</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
        {message}
      </div>
      <p className="text-sm text-muted-foreground">
        Войдите в аккаунт и запросите письмо повторно в баннере подтверждения.
      </p>
      <Button asChild variant="outline" className="w-full">
        <Link href="/login">Войти</Link>
      </Button>
    </div>
  )
}
