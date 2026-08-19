"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

/**
 * Заявка на покупку продукта на «Тарифе за размещение». Оплата идёт напрямую
 * разработчику (вне площадки); заявка уведомляет его, дальше он подтверждает оплату.
 */
export function RequestPurchaseButton({ productId }: { productId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/products/${productId}/request`, { method: "POST" })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 409 && d.purchaseId) {
          router.push(`/purchases/${d.purchaseId}`)
          return
        }
        setError(typeof d.error === "string" ? d.error : "Не удалось оформить заявку")
        return
      }
      router.push(`/purchases/${d.purchaseId}`)
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" size="lg" onClick={submit} disabled={loading}>
        {loading ? "Оформляем…" : "Я оплатил — оформить заявку"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
