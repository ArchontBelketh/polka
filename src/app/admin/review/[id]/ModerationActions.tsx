"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface ModerationActionsProps {
  productId: string
  productStatus: string
}

type Action = "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" | "SUSPENDED" | "RESTORED"

export function ModerationActions({ productId, productStatus }: ModerationActionsProps) {
  const router = useRouter()
  const [comment, setComment] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState(false)

  async function act(action: Action) {
    if (action === "SUSPENDED" && !comment.trim()) {
      setError("Укажите причину отзыва")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/moderation/${productId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: comment.trim() || undefined }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? "Ошибка")
        return
      }
      // After suspension/restore go to admin desktop, otherwise to queue
      if (action === "SUSPENDED" || action === "RESTORED") {
        router.push("/admin")
      } else {
        router.push("/admin/queue")
      }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  // APPROVED → show revoke UI
  if (productStatus === "APPROVED") {
    return (
      <section className="rounded-lg border border-amber-500/30 bg-card p-5 space-y-4">
        <h2 className="font-semibold">Управление публикацией</h2>
        <p className="text-sm text-muted-foreground">
          Продукт опубликован в каталоге. Вы можете отозвать публикацию — продукт будет скрыт из каталога.
        </p>

        {!confirmRevoke ? (
          <Button
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10"
            onClick={() => setConfirmRevoke(true)}
          >
            Отозвать публикацию
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Причина отзыва <span className="text-destructive">*</span>
              </label>
              <Textarea
                placeholder="Опишите причину — разработчик получит уведомление..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                autoFocus
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3">
              <Button
                variant="destructive"
                onClick={() => act("SUSPENDED")}
                disabled={loading || !comment.trim()}
              >
                {loading ? "Отзываем…" : "Подтвердить отзыв"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setConfirmRevoke(false); setComment(""); setError(null) }}
                disabled={loading}
              >
                Отмена
              </Button>
            </div>
          </div>
        )}
      </section>
    )
  }

  // SUSPENDED → show restore UI
  if (productStatus === "SUSPENDED") {
    return (
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold">Управление публикацией</h2>
        <p className="text-sm text-muted-foreground">
          Публикация отозвана. Вы можете восстановить продукт в каталоге.
        </p>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Комментарий (необязательно)</label>
          <Textarea
            placeholder="Пояснение для разработчика..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={() => act("RESTORED")}
          disabled={loading}
        >
          {loading ? "Восстанавливаем…" : "Восстановить в каталог"}
        </Button>
      </section>
    )
  }

  // REJECTED / DRAFT → no actions
  if (productStatus === "REJECTED" || productStatus === "DRAFT") {
    return null
  }

  // PENDING / SCAN_FAILED → standard moderation buttons
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
