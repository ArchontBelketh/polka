"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface AnswerFormProps {
  questionId: string
  initialAnswer?: string | null
  onCancel?: () => void
}

export function AnswerForm({ questionId, initialAnswer, onCancel }: AnswerFormProps) {
  const router = useRouter()
  const [text, setText] = useState(initialAnswer ?? "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: text }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Не удалось сохранить ответ")
        return
      }
      onCancel?.()
      router.refresh()
    } catch {
      setError("Ошибка соединения")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 pt-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ваш ответ покупателю…"
        rows={3}
        maxLength={2000}
        required
        autoFocus
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={loading || text.trim().length < 2}>
          {loading ? "Сохранение…" : "Сохранить ответ"}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={loading}>
            Отмена
          </Button>
        )}
      </div>
    </form>
  )
}
