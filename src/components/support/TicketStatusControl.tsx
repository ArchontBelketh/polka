"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

const TRANSITIONS: Record<string, { label: string; next: string }[]> = {
  OPEN:        [{ label: "В работу", next: "IN_PROGRESS" }, { label: "Закрыть", next: "CLOSED" }],
  IN_PROGRESS: [{ label: "Решено", next: "RESOLVED" },    { label: "Закрыть", next: "CLOSED" }],
  RESOLVED:    [{ label: "Закрыть", next: "CLOSED" },     { label: "Переоткрыть", next: "IN_PROGRESS" }],
  CLOSED:      [{ label: "Переоткрыть", next: "OPEN" }],
}

export function TicketStatusControl({ ticketId, status }: { ticketId: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const actions = TRANSITIONS[status] ?? []
  if (actions.length === 0) return null

  async function setStatus(next: string) {
    setLoading(true)
    await fetch(`/api/support/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {actions.map((a) => (
        <Button
          key={a.next}
          size="sm"
          variant={a.next === "CLOSED" ? "destructive" : "outline"}
          onClick={() => setStatus(a.next)}
          disabled={loading}
        >
          {a.label}
        </Button>
      ))}
    </div>
  )
}
