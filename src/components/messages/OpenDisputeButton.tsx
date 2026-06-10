"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle } from "lucide-react"

interface OpenDisputeButtonProps {
  purchaseId: string
}

export function OpenDisputeButton({ purchaseId }: OpenDisputeButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open", purchaseId, reason }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Не удалось открыть спор")
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError("Ошибка соединения")
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="text-red-400" onClick={() => setOpen(true)}>
        <AlertTriangle className="mr-1 h-4 w-4" />
        Открыть спор
      </Button>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
      <p className="text-sm font-medium text-foreground">Открыть спор</p>
      <p className="text-xs text-muted-foreground">
        Опишите проблему. Модератор изучит переписку и продукт и примет решение о возврате.
        Сначала попробуйте решить вопрос с разработчиком в переписке.
      </p>
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Что именно не работает или не соответствует описанию…"
        rows={3}
        minLength={10}
        maxLength={1000}
        required
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant="destructive" disabled={loading || reason.trim().length < 10}>
          {loading ? "Отправка…" : "Открыть спор"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
          Отмена
        </Button>
      </div>
    </form>
  )
}
