"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface PaymentActionsProps {
  intentId: string
  status: string
  hasPaymentId: boolean
  /** purchaseId для возврата (только для type=purchase в статусе CONFIRMED) */
  refundablePurchaseId?: string
  refundState?: string
}

export function PaymentActions({ intentId, status, hasPaymentId, refundablePurchaseId, refundState }: PaymentActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [refundPending, setRefundPending] = useState(false)

  async function recheck() {
    setLoading("recheck")
    setMsg(null)
    try {
      const res = await fetch(`/api/admin/payments/${intentId}/recheck`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg(typeof data.error === "string" ? data.error : "Ошибка")
        return
      }
      setMsg(`Т-Банк: ${data.status}${data.applied ? " — применено" : ""}`)
      router.refresh()
    } catch {
      setMsg("Ошибка соединения")
    } finally {
      setLoading(null)
    }
  }

  async function refund() {
    if (!refundablePurchaseId) return
    if (!refundState && !refundPending && !confirm("Оформить возврат покупателю? Действие необратимо.")) return
    setLoading("refund")
    setMsg(null)
    try {
      const res = await fetch(`/api/admin/purchases/${refundablePurchaseId}/refund`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg(typeof data.error === "string" ? data.error : "Ошибка")
        return
      }
      setRefundPending(data.pending === true)
      setMsg(data.pending ? data.message : "Возврат подтверждён банком и учтён")
      router.refresh()
    } catch {
      setMsg("Ошибка соединения")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        {hasPaymentId && (
          <Button size="sm" variant="outline" disabled={loading !== null} onClick={recheck}>
            {loading === "recheck" ? "…" : "Проверить"}
          </Button>
        )}
        {refundablePurchaseId && status === "CONFIRMED" && refundState !== "APPLIED" && (
          <Button size="sm" variant={refundState || refundPending ? "outline" : "destructive"} disabled={loading !== null} onClick={refund}>
            {loading === "refund" ? "…" : refundState || refundPending ? "Проверить возврат" : "Вернуть"}
          </Button>
        )}
      </div>
      {refundState === "APPLIED" && <p className="text-xs text-muted-foreground">Возврат учтён</p>}
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  )
}
