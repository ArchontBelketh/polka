"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Star } from "lucide-react"

interface ReviewFormProps {
  productId: string
  onSubmitted?: () => void
}

export function ReviewForm({ productId, onSubmitted }: ReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating === 0) {
      setError("Выберите оценку")
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, rating, text }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Ошибка при сохранении отзыва")
        return
      }
      setDone(true)
      onSubmitted?.()
    } catch {
      setError("Ошибка соединения")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
        ✓ Спасибо за отзыв! Он появится на странице после обновления.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Ваша оценка</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              className="p-0.5 focus:outline-none"
            >
              <Star
                className={`h-6 w-6 transition-colors ${
                  n <= (hovered || rating)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground/30"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="review-text" className="text-sm font-medium">
          Текст отзыва
        </label>
        <Textarea
          id="review-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Расскажите о вашем опыте использования продукта..."
          rows={4}
          minLength={10}
          maxLength={2000}
          required
        />
        <p className="text-xs text-muted-foreground text-right">{text.length}/2000</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button type="submit" disabled={loading || text.length < 10 || rating === 0}>
        {loading ? "Отправка…" : "Оставить отзыв"}
      </Button>
    </form>
  )
}
