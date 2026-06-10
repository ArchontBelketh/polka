"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface QuestionFormProps {
  productId: string
}

export function QuestionForm({ productId }: QuestionFormProps) {
  const router = useRouter()
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/products/${productId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Не удалось отправить вопрос")
        return
      }
      setText("")
      setDone(true)
      router.refresh()
    } catch {
      setError("Ошибка соединения")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium">Задать вопрос автору</p>
      <Textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setDone(false)
        }}
        placeholder="Например: работает ли с самозанятыми? Нужен ли VPS для запуска?"
        rows={3}
        maxLength={1000}
        required
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {done ? "✓ Вопрос отправлен" : "Контакты (телефон, email, мессенджеры) запрещены до покупки"}
        </p>
        <span className="text-xs text-muted-foreground">{text.length}/1000</span>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" size="sm" disabled={loading || text.trim().length < 5}>
        {loading ? "Отправка…" : "Отправить вопрос"}
      </Button>
    </form>
  )
}
