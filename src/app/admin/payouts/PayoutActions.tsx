"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface PayoutActionsProps {
  payoutId: string
  status: string
}

export function PayoutActions({ payoutId, status }: PayoutActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function set(next: "PROCESSING" | "PAID" | "REJECTED") {
    setLoading(next)
    setError(null)
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
      router.refresh()
    } catch {
      setError("Ошибка соединения")
    } finally {
      setLoading(null)
    }
  }

  if (status === "PAID" || status === "REJECTED") return null

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
          className="bg-green-600 hover:bg-green-700 text-white"
          disabled={loading !== null}
          onClick={() => set("PAID")}
        >
          {loading === "PAID" ? "…" : "Выплачено"}
        </Button>
        <Button size="sm" variant="destructive" disabled={loading !== null} onClick={() => set("REJECTED")}>
          {loading === "REJECTED" ? "…" : "Отклонить"}
        </Button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
