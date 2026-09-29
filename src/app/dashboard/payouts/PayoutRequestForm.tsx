"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/utils"

interface PayoutRequestFormProps {
  balance: number
}

export function PayoutRequestForm({ balance }: PayoutRequestFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/payouts", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Ошибка запроса")
        return
      }
      setSuccess(true)
      router.refresh()
    } catch {
      setError("Ошибка соединения")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
        ✓ Запрос на вывод отправлен. Выплата поступит на указанные реквизиты.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Доступно к выводу: <span className="text-foreground font-medium">{formatPrice(balance)}</span>.
        Выводится вся сумма целиком.
      </p>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button onClick={handleSubmit} disabled={loading || balance <= 0}>
        {loading ? "Отправка…" : "Вывести всё"}
      </Button>

      <p className="text-xs text-muted-foreground">
        Выплата поступит на реквизиты, указанные в профиле. Обработка — по вторникам и пятницам.
      </p>
    </div>
  )
}
