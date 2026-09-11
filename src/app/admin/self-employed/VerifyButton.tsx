"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function VerifyButton({ userId }: { userId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function check() {
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch("/api/admin/verify-self-employed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg(typeof d.error === "string" ? d.error : "Ошибка")
        return
      }
      setMsg(d.message || (d.verified ? "Самозанятый ✓" : "Не самозанятый"))
      router.refresh()
    } catch {
      setMsg("Ошибка соединения")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" disabled={loading} onClick={check}>
        {loading ? "Проверяем…" : "Проверить"}
      </Button>
      {msg && <p className="max-w-[240px] text-right text-xs text-muted-foreground">{msg}</p>}
    </div>
  )
}
