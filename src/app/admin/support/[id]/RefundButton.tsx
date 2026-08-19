"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

/** Операторский возврат покупателю по претензии (модель «Комиссия»). */
export function RefundButton({ purchaseId }: { purchaseId: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refund() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/purchases/${purchaseId}/refund`, { method: "POST" })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(typeof d.error === "string" ? d.error : "Ошибка возврата")
        return
      }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (!confirm) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="border-destructive text-destructive hover:bg-destructive/10"
        onClick={() => setConfirm(true)}
      >
        Оформить возврат покупателю
      </Button>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Полный возврат покупателю через платёжную систему. Если сумма уже зачислена разработчику —
        она будет удержана с его баланса. Отменить нельзя.
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" onClick={refund} disabled={loading}>
          {loading ? "Возврат…" : "Подтвердить возврат"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirm(false)} disabled={loading}>
          Отмена
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
