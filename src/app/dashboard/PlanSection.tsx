"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SLOT_PACKAGES, PRO_AMOUNT_KOPECKS } from "@/lib/developer-plan-constants"

interface Props {
  plan: "FREE" | "PRO"
  isProActive: boolean
  totalSlots: number
  usedSlots: number
  proUntil: string | null
}

function formatPrice(kopecks: number) {
  return `₽ ${(kopecks / 100).toLocaleString("ru-RU")}`
}

export function PlanSection({ plan, isProActive, totalSlots, usedSlots, proUntil }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const availableSlots = isProActive ? "∞" : Math.max(0, totalSlots - usedSlots)
  const proUntilDate = proUntil
    ? new Date(proUntil).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
    : null

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
    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Тариф</h2>
        <Badge variant={isProActive ? "default" : "secondary"}>
          {isProActive ? "Pro" : "Бесплатный"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Слоты продуктов</p>
          <p className="font-semibold mt-0.5">
            {usedSlots} / {isProActive ? "∞" : totalSlots}
            <span className="text-xs text-muted-foreground font-normal ml-1">
              (свободно: {availableSlots})
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Комиссия платформы</p>
          <p className="font-semibold mt-0.5">{isProActive ? "17%" : "20%"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Модерация</p>
          <p className="font-semibold mt-0.5">{isProActive ? "Приоритет (12ч)" : "Стандарт"}</p>
        </div>
      </div>

      {isProActive && proUntilDate && (
        <p className="text-xs text-muted-foreground">
          Pro активен до {proUntilDate}. После истечения тариф вернётся на бесплатный.
        </p>
      )}

      {!expanded ? (
        <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
          {isProActive ? "Продлить Pro / купить слоты" : "Улучшить тариф"}
        </Button>
      ) : (
        <div className="space-y-4">
          {/* Slot packages */}
          {!isProActive && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Дополнительные слоты (навсегда)
              </p>
              <div className="grid gap-2">
                {SLOT_PACKAGES.map((pkg) => (
                  <div
                    key={pkg.slots}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <div>
                      <span className="text-sm font-medium">{pkg.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">{pkg.description}</span>
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
          )}

          {/* Pro subscription */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Pro-подписка</p>
                <p className="text-xs text-muted-foreground">
                  Неограниченные продукты · 17% комиссия · приоритетная модерация
                </p>
              </div>
              <Button size="sm" onClick={buyPro} disabled={isPending}>
                {isPending ? "…" : `${formatPrice(PRO_AMOUNT_KOPECKS)}/мес`}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Окупается при ~7 продажах по ₽5 000/мес (экономия 3% = ₽1 050 покрывает подписку)
            </p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            onClick={() => { setExpanded(false); setError(null) }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Свернуть
          </button>
        </div>
      )}
    </section>
  )
}
