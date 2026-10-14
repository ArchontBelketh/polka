"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { SERVICE_STATUS_LABELS, SERVICE_STATUSES } from "@/lib/services"
import type { ServiceOrderStatus } from "@/generated/prisma/client"

interface Props {
  orderId: string
  status: ServiceOrderStatus
  report: string
  expertId: string
  isExpertService: boolean
  executors: { id: string; name: string }[]
}

export function ServiceActions({ orderId, status, report, expertId, isExpertService, executors }: Props) {
  const router = useRouter()
  const [newStatus, setNewStatus] = useState<string>(status)
  const [reportVal, setReportVal] = useState(report)
  const [expert, setExpert] = useState(expertId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save() {
    setLoading(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/admin/services/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          report: isExpertService ? reportVal : undefined,
          expertId: isExpertService ? (expert || null) : undefined,
        }),
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
      <h2 className="font-semibold">Управление заказом</h2>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Статус</label>
        <select
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value)}
          className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {SERVICE_STATUSES.map((s) => (
            <option key={s} value={s}>{SERVICE_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          При статусе «Отчёт готов» заказчику уходит письмо. При «Закрыт» прикреплённый код удаляется.
        </p>
      </div>

      {isExpertService && (
        <>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Эксперт</label>
            <select
              value={expert}
              onChange={(e) => setExpert(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— не назначен —</option>
              {executors.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Отчёт заказчику</label>
            <Textarea value={reportVal} onChange={(e) => setReportVal(e.target.value)} rows={10} maxLength={20000} />
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-green-500">Сохранено.</p>}

      <Button onClick={save} disabled={loading}>{loading ? "Сохранение…" : "Сохранить"}</Button>
    </section>
  )
}
