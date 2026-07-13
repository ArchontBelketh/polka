"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export interface ThreadMessage {
  id: string
  text: string
  senderId: string
  createdAt: string
}

interface MessageThreadProps {
  purchaseId: string
  currentUserId: string
  initialMessages: ThreadMessage[]
  canWrite: boolean
}

const POLL_MS = 15_000

export function MessageThread({
  purchaseId,
  currentUserId,
  initialMessages,
  canWrite,
}: MessageThreadProps) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  async function refresh() {
    try {
      const res = await fetch(`/api/purchases/${purchaseId}/messages`, { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      setMessages((prev) => {
        if (data.messages.length !== prev.length) return data.messages
        return prev
      })
    } catch {
      // ignore transient poll errors
    }
  }

  // Poll for new messages
  useEffect(() => {
    const t = setInterval(refresh, POLL_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseId])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    setError(null)
    setSending(true)
    try {
      const res = await fetch(`/api/purchases/${purchaseId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Не удалось отправить")
        return
      }
      setMessages((prev) => [...prev, data as ThreadMessage])
      setText("")
    } catch {
      setError("Ошибка соединения")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card">
      <div className="max-h-96 min-h-32 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Сообщений пока нет. Напишите первым.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === currentUserId
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                    mine
                      ? "bg-primary text-white"
                      : "bg-muted text-foreground",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p className={cn("mt-1 text-[10px]", mine ? "text-white/70" : "text-muted-foreground")}>
                    {new Date(m.createdAt).toLocaleString("ru-RU", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {canWrite ? (
        <form onSubmit={send} className="border-t border-border p-3 space-y-2">
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex items-end gap-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(e)
              }}
              placeholder="Сообщение… (Ctrl+Enter — отправить)"
              rows={2}
              maxLength={2000}
              className="flex-1 resize-none"
            />
            <Button type="submit" size="sm" disabled={sending || !text.trim()}>
              {sending ? "…" : "Отправить"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="border-t border-border p-3 text-center text-xs text-muted-foreground">
          Переписка закрыта.
        </p>
      )}
    </div>
  )
}
