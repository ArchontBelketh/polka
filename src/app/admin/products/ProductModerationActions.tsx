"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/** Быстрый отзыв публикации (kill-switch) прямо из списка продуктов. */
export function SuspendButton({ id }: { id: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  function suspend() {
    if (!reason.trim()) {
      setError("Укажите причину")
      return
    }
    startTransition(async () => {
      const res = await fetch(`/api/moderation/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUSPENDED", comment: reason.trim() }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? "Ошибка")
        return
      }
      setShowForm(false)
      setReason("")
      router.refresh()
    })
  }

  if (showForm) {
    return (
      <div className="flex items-center gap-2 justify-end">
        <Input
          value={reason}
          onChange={(e) => { setReason(e.target.value); setError(null) }}
          placeholder="Причина отзыва"
          className="h-8 text-xs w-44"
          maxLength={500}
          autoFocus
          onKeyDown={(e) => { if (e.key === "Escape") setShowForm(false) }}
        />
        <Button size="sm" variant="destructive" onClick={suspend} disabled={isPending} className="h-8">
          {isPending ? "…" : "Снять"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setError(null) }} className="h-8">
          Отмена
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    )
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-8 text-destructive hover:text-destructive"
      onClick={() => setShowForm(true)}
    >
      Снять с публикации
    </Button>
  )
}

/** Восстановление снятого продукта обратно в каталог. */
export function RestoreButton({ id }: { id: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function restore() {
    startTransition(async () => {
      await fetch(`/api/moderation/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESTORED" }),
      })
      router.refresh()
    })
  }

  return (
    <Button size="sm" variant="outline" className="h-8" onClick={restore} disabled={isPending}>
      {isPending ? "…" : "Восстановить"}
    </Button>
  )
}
