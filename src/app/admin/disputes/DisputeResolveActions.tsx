"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface DisputeResolveActionsProps {
  purchaseId: string
}

export function DisputeResolveActions({ purchaseId }: DisputeResolveActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<"REFUNDED" | "DELIVERED" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function resolve(resolution: "REFUNDED" | "DELIVERED") {
    setError(null)
    setLoading(resolution)
    try {
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", purchaseId, resolution }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Не удалось разрешить спор")
        return
      }
      router.refresh()
    } catch {
      setError("Ошибка соединения")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={loading !== null}
          onClick={() => resolve("REFUNDED")}
        >
          {loading === "REFUNDED" ? "…" : "Вернуть деньги покупателю"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={loading !== null}
          onClick={() => resolve("DELIVERED")}
        >
          {loading === "DELIVERED" ? "…" : "Отклонить спор (оставить продавцу)"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
