"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MessageCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface FeedbackWidgetProps {
  isLoggedIn: boolean
}

const CATEGORIES = [
  { value: "OTHER",    label: "Общий вопрос" },
  { value: "BUG",      label: "Ошибка на сайте" },
  { value: "PURCHASE", label: "Вопрос по покупке" },
  { value: "APPEAL",   label: "Обжалование решения" },
]

export function FeedbackWidget({ isLoggedIn }: FeedbackWidgetProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState("OTHER")
  const [subject, setSubject] = useState("")
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setCategory("OTHER")
    setSubject("")
    setText("")
    setError(null)
  }

  function close() {
    setOpen(false)
    reset()
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, category, text }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? `Ошибка отправки (${res.status})`)
        return
      }
      const data = await res.json()
      close()
      router.push(`/support/${data.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => isLoggedIn ? setOpen(true) : router.push("/login")}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        aria-label="Написать в поддержку"
      >
        <MessageCircle className="h-4 w-4" />
        Поддержка
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end p-6 sm:items-center sm:justify-center"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" />

          {/* Dialog */}
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold">Написать в поддержку</h2>
              <button
                onClick={close}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={submit} className="p-5 space-y-4">
              {/* Category */}
              <div className="space-y-1.5">
                <Label>Тема обращения</Label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory(c.value)}
                      className={`rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                        category === c.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-foreground/30"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <Label htmlFor="fw-subject">Кратко опишите проблему</Label>
                <Input
                  id="fw-subject"
                  placeholder="Не могу скачать файл после оплаты"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                  required
                />
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <Label htmlFor="fw-text">Подробности</Label>
                <Textarea
                  id="fw-text"
                  placeholder="Опишите ситуацию подробнее..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  required
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex justify-end gap-3 pt-1">
                <Button type="button" variant="ghost" onClick={close} disabled={loading}>
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !subject.trim() || !text.trim()}
                >
                  {loading ? "Отправляем…" : "Отправить"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
