"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  versionId: string
}

export function VersionModerationActions({ versionId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showReject, setShowReject] = useState(false)
  const [rejectComment, setRejectComment] = useState("")

  async function handleAction(action: "APPROVED" | "REJECTED") {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/moderation/versions/${versionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "APPROVED"
            ? { action: "APPROVED" }
            : { action: "REJECTED", comment: rejectComment.trim() },
        ),
      })
      const data = await res.json()
      if (!res.ok) {
        const errMsg = typeof data.error === "string" ? data.error : "Ошибка сервера"
        setError(errMsg)
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

      {!showReject ? (
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => handleAction("APPROVED")}
            disabled={loading}
          >
            {loading ? "Сохраняем…" : "Одобрить версию"}
          </Button>
          <Button
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10"
            onClick={() => setShowReject(true)}
            disabled={loading}
          >
            Отклонить
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Укажите причину отказа — разработчик получит уведомление.</p>
          <Textarea
            placeholder="Причина отказа..."
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            rows={3}
            autoFocus
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3">
            <Button
              variant="destructive"
              onClick={() => handleAction("REJECTED")}
              disabled={loading || !rejectComment.trim()}
            >
              {loading ? "Сохраняем…" : "Подтвердить отказ"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setShowReject(false); setRejectComment(""); setError(null) }}
              disabled={loading}
            >
              Отмена
            </Button>
          </div>
        </div>
      )}

      {!showReject && error && <p className="text-sm text-red-500">{error}</p>}
    </section>
  )
}
