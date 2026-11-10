"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface PayoutActionsProps {
  payoutId: string
  status: string
  receiptSent?: boolean
}

export function PayoutActions({ payoutId, status, receiptSent = false }: PayoutActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [receiptPending, setReceiptPending] = useState(false)

  async function set(next: "PROCESSING" | "PAID" | "REJECTED") {
    setLoading(next)
    setError(null)
    setReceiptPending(false)
    try {
      const res = await fetch(`/api/admin/payouts/${payoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Ошибка")
        return
      }
      if (data.receipt && data.receipt.ok === false) {
        setReceiptPending(data.receipt.pending === true)
        setError(data.receipt.message ?? "Статус чека не подтверждён. Проверьте кассу перед повторной отправкой.")
      }
      router.refresh()
    } catch {
      setError("Ошибка соединения")
    } finally {
      setLoading(null)
    }
  }

  if (status === "REJECTED" || (status === "PAID" && receiptSent)) return null

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        {status === "PENDING" && (
          <Button size="sm" variant="outline" disabled={loading !== null} onClick={() => set("PROCESSING")}>
            {loading === "PROCESSING" ? "…" : "В обработку"}
          </Button>
        )}
        <Button
          size="sm"
          variant={status === "PAID" ? "outline" : "default"}
          className={status === "PAID" ? undefined : "bg-green-600 hover:bg-green-700 text-white"}
          disabled={loading !== null}
          onClick={() => set("PAID")}
        >
          {loading === "PAID" ? "…" : status === "PAID" ? "Проверить чек" : "Выплачено"}
        </Button>
        {status !== "PAID" && <Button size="sm" variant="destructive" disabled={loading !== null} onClick={() => set("REJECTED")}>
          {loading === "REJECTED" ? "…" : "Отклонить"}
        </Button>}
      </div>
      {status === "PAID" && !receiptSent && <p className="text-xs text-muted-foreground">Выплата отмечена. Чек ещё не подтверждён.</p>}
      {error && <p role={receiptPending ? "status" : "alert"} className={`text-xs ${receiptPending ? "text-muted-foreground" : "text-red-400"}`}>{error}</p>}
    </div>
  )
}
