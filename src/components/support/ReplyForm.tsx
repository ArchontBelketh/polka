"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export function ReplyForm({ ticketId, closed }: { ticketId: string; closed: boolean }) {
  const router = useRouter()
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (closed) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Обращение закрыто. Создайте новое, если вопрос не решён.
      </p>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/support/${ticketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? "Ошибка")
        return
      }
      setText("")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Textarea
        placeholder="Напишите ответ..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        disabled={loading}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={loading || !text.trim()}>
        {loading ? "Отправляем…" : "Отправить"}
      </Button>
    </form>
  )
}
