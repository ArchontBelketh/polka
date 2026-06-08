"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function BanButton({ id, name }: { id: string; name: string | null }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [reason, setReason] = useState("")

  function ban() {
    startTransition(async () => {
      await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ban", reason: reason.trim() || undefined }),
      })
      setShowForm(false)
      setReason("")
      router.refresh()
    })
  }

  if (showForm) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Причина (необязательно)"
          className="h-8 text-xs w-48"
          maxLength={500}
          autoFocus
          onKeyDown={(e) => { if (e.key === "Escape") setShowForm(false) }}
        />
        <Button size="sm" variant="destructive" onClick={ban} disabled={isPending} className="h-8">
          {isPending ? "…" : "Заблокировать"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="h-8">
          Отмена
        </Button>
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
      Заблокировать
    </Button>
  )
}

export function UnbanButton({ id }: { id: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function unban() {
    startTransition(async () => {
      await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unban" }),
      })
      router.refresh()
    })
  }

  return (
    <Button size="sm" variant="outline" className="h-8" onClick={unban} disabled={isPending}>
      {isPending ? "…" : "Разблокировать"}
    </Button>
  )
}
