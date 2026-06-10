"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

const MIN = 500
const MAX = 50000
const STEP = 500
const PAYMENT_FEE = 0.025 // эквайринг

const PLANS = {
  free: { label: "Бесплатный", commission: 0.2 },
  pro: { label: "Pro", commission: 0.17 },
} as const

type Plan = keyof typeof PLANS

function rub(n: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n)
}

export function IncomeCalculator() {
  const [price, setPrice] = useState(2000)
  const [plan, setPlan] = useState<Plan>("free")

  const commission = PLANS[plan].commission
  const net = Math.round(price * (1 - commission) * (1 - PAYMENT_FEE))
  const platformCut = price - net
  const pct = Math.round((net / price) * 100)

  return (
    <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">Сколько вы заработаете</h3>
        <p className="text-sm text-muted-foreground">
          Подвиньте ползунок, чтобы прикинуть доход с одной продажи.
        </p>
      </div>

      {/* Plan toggle */}
      <div className="inline-flex rounded-lg border border-border bg-muted/50 p-1">
        {(Object.keys(PLANS) as Plan[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPlan(p)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              plan === p ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {PLANS[p].label} · {Math.round(PLANS[p].commission * 100)}%
          </button>
        ))}
      </div>

      {/* Slider */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Цена продукта</span>
          <span className="text-2xl font-bold tabular-nums text-foreground">{rub(price)}</span>
        </div>
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{rub(MIN)}</span>
          <span>{rub(MAX)}</span>
        </div>
      </div>

      {/* Result */}
      <div className="rounded-lg bg-muted/50 p-4 space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Вы получаете</span>
          <span className="text-3xl font-bold tabular-nums text-primary">{rub(net)}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Комиссия площадки + эквайринг</span>
          <span>−{rub(platformCut)}</span>
        </div>
        <p className="pt-1 text-xs text-muted-foreground">
          Это {pct}% от цены. Комиссия {Math.round(commission * 100)}% + эквайринг 2,5% удерживаются
          автоматически, остальное идёт на ваш баланс.
        </p>
      </div>
    </div>
  )
}
