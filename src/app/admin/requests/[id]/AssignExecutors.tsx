"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface Props {
  requestId: string
  consentContacts: boolean
  available: { id: string; name: string }[]
  assigned: { id: string; executorName: string; responded: boolean }[]
}

export function AssignExecutors({ requestId, consentContacts, available, assigned }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canAddMore = 3 - assigned.length

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < canAddMore) next.add(id)
      return next
    })
  }

  async function send() {
    if (selected.size === 0) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/requests/${requestId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executorIds: [...selected] }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(typeof d.error === "string" ? d.error : "Ошибка"); return }
      setSelected(new Set())
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function toggleResponded(assignmentId: string, responded: boolean) {
    await fetch(`/api/admin/assignments/${assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responded }),
    })
    router.refresh()
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
      <h2 className="font-semibold">Исполнители</h2>

      {!consentContacts && (
        <p className="text-sm text-amber-400">
          Заказчик не дал согласия на передачу контактов — отправка исполнителям недоступна.
        </p>
      )}

      {/* Уже отправлено */}
      {assigned.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Отправлено ({assigned.length}/3)</p>
          <ul className="space-y-1.5">
            {assigned.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{a.executorName}</span>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={a.responded} onChange={(e) => toggleResponded(a.id, e.target.checked)} className="h-4 w-4" />
                  ответил
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Выбрать и отправить */}
      {consentContacts && canAddMore > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Выбрать дежурных (ещё можно {canAddMore})
          </p>
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет доступных дежурных исполнителей.</p>
          ) : (
            <div className="space-y-1.5">
              {available.map((e) => (
                <label key={e.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.has(e.id)}
                    onChange={() => toggle(e.id)}
                    disabled={!selected.has(e.id) && selected.size >= canAddMore}
                    className="h-4 w-4"
                  />
                  {e.name}
                </label>
              ))}
            </div>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button size="sm" onClick={send} disabled={loading || selected.size === 0}>
            {loading ? "Отправка…" : `Отправить (${selected.size})`}
          </Button>
        </div>
      )}
    </section>
  )
}
