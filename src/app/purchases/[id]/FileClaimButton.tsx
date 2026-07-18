"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

/**
 * Подача претензии по покупке. Создаёт тикет поддержки категории CLAIM и
 * ведёт покупателя в этот тикет. Возвраты вне площадки — решает разработчик.
 */
export function FileClaimButton({ purchaseId }: { purchaseId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (text.trim().length < 20) {
      setError("Опишите проблему подробнее (минимум 20 символов)")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/purchases/${purchaseId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Претензия уже есть — просто ведём в неё
        if (res.status === 409 && d.ticketId) {
          router.push(`/support/${d.ticketId}`)
          return
        }
        setError(typeof d.error === "string" ? d.error : "Не удалось подать претензию")
        return
      }
      router.push(`/support/${d.ticketId}`)
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.")
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Проблема с покупкой? Подать претензию
      </button>
    )
  }

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <p className="text-sm font-medium">Претензия по покупке</p>
      <p className="text-xs text-muted-foreground">
        Опишите, что не соответствует описанию или не работает при соблюдении системных
        требований и инструкции. Претензию сопровождает поддержка площадки; возврат, если он
        обоснован, производит разработчик.
      </p>
      <Textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setError(null) }}
        rows={3}
        placeholder="Опишите проблему и приложите детали…"
        maxLength={2000}
        autoFocus
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={loading}>
          {loading ? "Отправляем…" : "Отправить претензию"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setError(null) }}>
          Отмена
        </Button>
      </div>
    </div>
  )
}
