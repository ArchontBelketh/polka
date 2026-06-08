"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface BuyButtonProps {
  productId: string
  label?: string
}

export function BuyButton({ productId, label = "Купить" }: BuyButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleBuy() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
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

  return (
    <div className="space-y-2">
      <Button className="w-full" size="lg" onClick={handleBuy} disabled={loading}>
        {loading ? "Перенаправление…" : label}
      </Button>
      {error && <p className="text-sm text-red-400 text-center">{error}</p>}
    </div>
  )
}
