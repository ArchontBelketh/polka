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

/**
 * Отдельная кнопка «Информировать покупателей» — отзыв по безопасности.
 * Рассылает всем покупателям продукта выверенное предупреждение. Статус продукта
 * не меняет (снятие — отдельной кнопкой рядом). Действие исходящее и необратимое,
 * поэтому с подтверждением.
 */
function NotifyBuyersButton({ productId }: { productId: string }) {
  const [step, setStep] = useState<"idle" | "confirm" | "done">("idle")
  const [note, setNote] = useState("")
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/moderation/${productId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SECURITY_NOTICE", comment: note.trim() || undefined }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d.error ?? "Ошибка")
        return
      }
      setCount(d.notified ?? 0)
      setStep("done")
    } finally {
      setLoading(false)
    }
  }

  if (step === "done") {
    return (
      <p className="text-sm text-green-500">
        Предупреждение отправлено покупателям: {count}.
      </p>
    )
  }

  if (step === "confirm") {
    return (
      <div className="space-y-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
        <p className="text-sm text-muted-foreground">
          Всем покупателям этого продукта уйдёт предупреждение о проблеме безопасности
          (Telegram и email) с рекомендацией проверить систему и сменить пароли. Отправка
          необратима.
        </p>
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">
            Внутренняя пометка для журнала (необязательно, покупателям не показывается)
          </label>
          <Textarea
            placeholder="Например: подтверждён бэкдор в версии 1.2…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-3">
          <Button variant="destructive" onClick={send} disabled={loading}>
            {loading ? "Отправляем…" : "Отправить предупреждение"}
          </Button>
          <Button variant="ghost" onClick={() => { setStep("idle"); setError(null) }} disabled={loading}>
            Отмена
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Button
      variant="outline"
      className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
      onClick={() => setStep("confirm")}
    >
      Информировать покупателей о проблеме безопасности
    </Button>
  )
}

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

        <div className="border-t border-border pt-4">
          <NotifyBuyersButton productId={productId} />
        </div>
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

        <div className="border-t border-border pt-4">
          <NotifyBuyersButton productId={productId} />
        </div>
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
