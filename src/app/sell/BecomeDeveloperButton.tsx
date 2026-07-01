"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SessionProvider, useSession } from "next-auth/react"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

function Inner() {
  const router = useRouter()
  const { update } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/developer/upgrade", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Не удалось стать разработчиком")
        return
      }
      await update() // обновляем роль в сессии (jwt trigger:"update") без пере-логина
      router.push("/dashboard")
      router.refresh()
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button size="lg" onClick={handle} disabled={loading} className="flex items-center gap-2">
        {loading ? "Оформляем…" : "Стать разработчиком"}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </Button>
      <p className="text-xs text-muted-foreground">Бесплатно. Откроется кабинет разработчика и 2 слота под продукты.</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

// Локальный SessionProvider — только для этой кнопки, чтобы работал update()
// без глобального провайдера на всём приложении.
export function BecomeDeveloperButton() {
  return (
    <SessionProvider>
      <Inner />
    </SessionProvider>
  )
}
