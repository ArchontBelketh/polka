"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface ModerationActionsProps {
  productId: string
}

type Action = "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"

export function ModerationActions({ productId }: ModerationActionsProps) {
  const router = useRouter()
  const [comment, setComment] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function act(action: Action) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/moderation/${productId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: comment || undefined }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? "Ошибка")
        return
      }
      router.push("/admin/queue")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
      <h2 className="font-semibold">Решение</h2>
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Комментарий (необязательно)</label>
        <Textarea
          placeholder="Причина отказа или требования к изменениям..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => act("APPROVED")}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          ✓ Одобрить
        </Button>
        <Button
          onClick={() => act("CHANGES_REQUESTED")}
          disabled={loading}
          variant="outline"
        >
          ✎ Запросить изменения
        </Button>
        <Button
          onClick={() => act("REJECTED")}
          disabled={loading}
          variant="destructive"
        >
          ✕ Отклонить
        </Button>
      </div>
    </section>
  )
}
