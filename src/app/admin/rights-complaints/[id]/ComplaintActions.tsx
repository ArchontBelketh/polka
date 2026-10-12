"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { COMPLAINT_STATUS_LABELS, COMPLAINT_STATUSES } from "@/lib/complaint-status"

interface Props {
  complaintId: string
  status: string
  decision: string
  hasProduct: boolean
}

export function ComplaintActions({ complaintId, status, decision, hasProduct }: Props) {
  const router = useRouter()
  const [newStatus, setNewStatus] = useState(status)
  const [decisionVal, setDecisionVal] = useState(decision)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save() {
    setLoading(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/admin/rights-complaints/${complaintId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, decision: decisionVal }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof d.error === "string" ? d.error : "Ошибка")
        return
      }
      setSaved(true)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
      <h2 className="font-semibold">Рассмотрение</h2>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Статус</label>
        <select
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value)}
          className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {COMPLAINT_STATUSES.map((s) => (
            <option key={s} value={s}>{COMPLAINT_STATUS_LABELS[s]}</option>
          ))}
        </select>
        {hasProduct ? (
          <p className="text-xs text-muted-foreground">
            «На рассмотрении»/«Удалён» — товар скрывается; «Восстановлен» — публикуется снова.
          </p>
        ) : (
          <p className="text-xs text-amber-400">Товар не привязан — действия со статусом его не затронут.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Решение / заметки</label>
        <Textarea value={decisionVal} onChange={(e) => setDecisionVal(e.target.value)} rows={4} maxLength={5000} />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-green-500">Сохранено.</p>}

      <Button onClick={save} disabled={loading}>{loading ? "Сохранение…" : "Сохранить"}</Button>
    </section>
  )
}
