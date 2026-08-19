"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export function ListingFeeButton({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pay() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/products/${productId}/listing-fee`, { method: "POST" })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof d.error === "string" ? d.error : "Не удалось создать платёж")
        return
      }
      if (d.confirmationUrl) window.location.href = d.confirmationUrl
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={pay} disabled={loading}>
        {loading ? "Переходим к оплате…" : "Оплатить тариф за размещение"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
