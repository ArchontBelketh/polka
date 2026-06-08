"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatPrice } from "@/lib/utils"

interface PayoutRequestFormProps {
  balance: number
}

export function PayoutRequestForm({ balance }: PayoutRequestFormProps) {
  const [amount, setAmount] = useState(Math.floor(balance / 100))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const maxRubles = Math.floor(balance / 100)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amount * 100 }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Ошибка запроса")
        return
      }
      setSuccess(true)
    } catch {
      setError("Ошибка соединения")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
        ✓ Запрос на вывод отправлен. Мы свяжемся с вами в течение 3 рабочих дней.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="amount" className="text-sm font-medium">
          Сумма вывода (руб.) — доступно {formatPrice(balance)}
        </label>
        <div className="flex gap-2">
          <Input
            id="amount"
            type="number"
            min={1}
            max={maxRubles}
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
            className="max-w-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAmount(maxRubles)}
          >
            Всё
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button type="submit" disabled={loading || amount <= 0 || amount > maxRubles}>
        {loading ? "Отправка…" : "Запросить вывод"}
      </Button>

      <p className="text-xs text-muted-foreground">
        Выплата поступит на реквизиты, указанные при регистрации, в течение 3 рабочих дней.
      </p>
    </form>
  )
}
