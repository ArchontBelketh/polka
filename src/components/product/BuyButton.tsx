"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatPrice } from "@/lib/utils"
import { Tag } from "lucide-react"

interface BuyButtonProps {
  productId: string
  price: number
  label?: string
}

export function BuyButton({ productId, price, label = "Купить" }: BuyButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [couponInput, setCouponInput] = useState("")
  const [couponOpen, setCouponOpen] = useState(false)
  const [couponChecking, setCouponChecking] = useState(false)
  const [couponResult, setCouponResult] = useState<{
    valid: boolean
    discountPct: number
    finalPrice: number
    error?: string
  } | null>(null)

  async function checkCoupon() {
    if (!couponInput.trim()) return
    setCouponChecking(true)
    setCouponResult(null)
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput.trim(), priceKopecks: price }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCouponResult({ valid: false, discountPct: 0, finalPrice: price, error: data.error })
      } else {
        setCouponResult({ valid: true, discountPct: data.discountPct, finalPrice: data.finalPrice })
      }
    } catch {
      setCouponResult({ valid: false, discountPct: 0, finalPrice: price, error: "Ошибка проверки" })
    } finally {
      setCouponChecking(false)
    }
  }

  async function handleBuy() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          ...(couponResult?.valid ? { couponCode: couponInput.trim() } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Ошибка оформления")
        return
      }
      if (data.confirmationUrl) {
        window.location.href = data.confirmationUrl
      }
    } catch {
      setError("Ошибка соединения с платёжной системой")
    } finally {
      setLoading(false)
    }
  }

  const displayPrice = couponResult?.valid ? couponResult.finalPrice : price

  return (
    <div className="space-y-3">
      <Button className="w-full" size="lg" onClick={handleBuy} disabled={loading}>
        {loading
          ? "Перенаправление…"
          : `${label} · ${formatPrice(displayPrice)}`}
      </Button>

      {!couponOpen ? (
        <button
          type="button"
          onClick={() => setCouponOpen(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
        >
          <Tag className="h-3 w-3" />
          Есть промокод?
        </button>
      ) : (
        <div className="flex gap-2">
          <Input
            value={couponInput}
            onChange={(e) => {
              setCouponInput(e.target.value.toUpperCase())
              setCouponResult(null)
            }}
            placeholder="ПРОМОКОД"
            className="text-xs h-8 font-mono uppercase"
            onKeyDown={(e) => e.key === "Enter" && checkCoupon()}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            onClick={checkCoupon}
            disabled={couponChecking || !couponInput.trim()}
          >
            {couponChecking ? "…" : "Применить"}
          </Button>
        </div>
      )}

      {couponResult && (
        <p className={`text-xs text-center ${couponResult.valid ? "text-green-400" : "text-red-400"}`}>
          {couponResult.valid
            ? `Скидка ${couponResult.discountPct}% — итого ${formatPrice(couponResult.finalPrice)}`
            : couponResult.error}
        </p>
      )}

      {error && <p className="text-sm text-red-400 text-center">{error}</p>}
    </div>
  )
}
