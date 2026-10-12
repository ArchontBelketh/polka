"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function ConfirmPaymentButton({ purchaseId }: { purchaseId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function act(path: "confirm" | "reject") {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/purchases/${purchaseId}/${path}`, { method: "POST" })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(typeof d.error === "string" ? d.error : "Ошибка")
        return
      }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (!confirm) {
    return (
      <Button size="sm" onClick={() => setConfirm(true)}>
        Подтвердить оплату
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={() => act("confirm")} disabled={loading}>
        {loading ? "…" : "Оплата получена — открыть доступ"}
      </Button>
      <Button size="sm" variant="destructive" onClick={() => act("reject")} disabled={loading}>
        Оплаты нет
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirm(false)} disabled={loading}>
        Отмена
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
