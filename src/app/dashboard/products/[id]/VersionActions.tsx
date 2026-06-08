"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface Props {
  productId: string
  versionId: string
  status: string
}

export function VersionActions({ productId, versionId, status }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function send(action: "suspend" | "restore" | "delete") {
    setError(null)
    const res = await fetch(`/api/products/${productId}/versions/${versionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError((data as { error?: string }).error ?? "Ошибка")
      return false
    }
    return true
  }

  function handleAction(action: "suspend" | "restore" | "delete") {
    startTransition(async () => {
      const ok = await send(action)
      if (ok) {
        setConfirmDelete(false)
        router.refresh()
      }
    })
  }

  // PENDING: can only delete (wasn't published, no buyer impact)
  if (status === "PENDING") {
    return (
      <div className="flex flex-col items-start gap-1">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            disabled={isPending}
          >
            Удалить
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              className="h-6 px-2 text-xs"
              onClick={() => handleAction("delete")}
              disabled={isPending}
            >
              {isPending ? "…" : "Подтвердить"}
            </Button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
              disabled={isPending}
            >
              Отмена
            </button>
          </div>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  // APPROVED: can suspend or delete (must suspend first before delete)
  if (status === "APPROVED") {
    return (
      <div className="flex flex-col items-start gap-1">
        <button
          onClick={() => handleAction("suspend")}
          className="text-xs text-muted-foreground hover:text-amber-400 transition-colors"
          disabled={isPending}
          title="Скрывает версию от покупателей. Они получат предыдущую версию или исходный файл."
        >
          {isPending ? "…" : "Снять с публикации"}
        </button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  // REJECTED: can only delete
  if (status === "REJECTED") {
    return (
      <div className="flex flex-col items-start gap-1">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            disabled={isPending}
          >
            Удалить
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              className="h-6 px-2 text-xs"
              onClick={() => handleAction("delete")}
              disabled={isPending}
            >
              {isPending ? "…" : "Подтвердить"}
            </Button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
              disabled={isPending}
            >
              Отмена
            </button>
          </div>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  // SUSPENDED: can restore to APPROVED or delete
  if (status === "SUSPENDED") {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <button
          onClick={() => handleAction("restore")}
          className="text-xs text-muted-foreground hover:text-green-400 transition-colors"
          disabled={isPending}
          title="Версия снова станет доступна покупателям для скачивания."
        >
          {isPending ? "…" : "Восстановить"}
        </button>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            disabled={isPending}
          >
            Удалить
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              className="h-6 px-2 text-xs"
              onClick={() => handleAction("delete")}
              disabled={isPending}
            >
              {isPending ? "…" : "Подтвердить"}
            </Button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
              disabled={isPending}
            >
              Отмена
            </button>
          </div>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  return null
}
