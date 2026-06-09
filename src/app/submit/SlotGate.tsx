"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { SLOT_PACKAGES, PRO_AMOUNT_KOPECKS } from "@/lib/developer-plan-constants"

interface Props {
  usedSlots: number
  totalSlots: number
}

function formatPrice(kopecks: number) {
  return `₽ ${(kopecks / 100).toLocaleString("ru-RU")}`
}

export function SlotGate({ usedSlots, totalSlots }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function buySlots(slots: 1 | 5 | 15) {
    startTransition(async () => {
      setError(null)
      try {
        const res = await fetch("/api/developer/slots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slots }),
        })
        const data = await res.json() as { confirmationUrl?: string; error?: string }
        if (!res.ok) { setError(data.error ?? "Ошибка"); return }
        if (data.confirmationUrl) window.location.replace(data.confirmationUrl)
      } catch {
        setError("Не удалось подключиться к серверу")
      }
    })
  }

  function buyPro() {
    startTransition(async () => {
      setError(null)
      try {
        const res = await fetch("/api/developer/pro", { method: "POST" })
        const data = await res.json() as { confirmationUrl?: string; error?: string }
        if (!res.ok) { setError(data.error ?? "Ошибка"); return }
        if (data.confirmationUrl) window.location.replace(data.confirmationUrl)
      } catch {
        setError("Не удалось подключиться к серверу")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 space-y-1">
        <p className="text-sm font-medium text-amber-400">Лимит продуктов исчерпан</p>
        <p className="text-sm text-muted-foreground">
          Вы используете {usedSlots} из {totalSlots} доступных слотов.
          Купите дополнительные слоты или оформите Pro-подписку.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Дополнительные слоты</h2>
        <div className="grid gap-3">
          {SLOT_PACKAGES.map((pkg) => (
            <div
              key={pkg.slots}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{pkg.label}</p>
                <p className="text-xs text-muted-foreground">{pkg.description}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => buySlots(pkg.slots as 1 | 5 | 15)}
                disabled={isPending}
              >
                {formatPrice(pkg.amountKopecks)}
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-4 space-y-3">
        <div>
          <p className="text-sm font-semibold">Pro-подписка</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Неограниченное количество продуктов · Комиссия 17% вместо 20% · Приоритетная модерация (12ч)
          </p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{formatPrice(PRO_AMOUNT_KOPECKS)}/мес</span>
          <Button size="sm" onClick={buyPro} disabled={isPending}>
            {isPending ? "Переход к оплате…" : "Оформить Pro"}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
