"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  productId: string
  productTitle: string
  productStatus: string
  productSlug: string
}

export function ProductActions({ productId, productTitle, productStatus, productSlug }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showAppeal, setShowAppeal] = useState(false)
  const [appealText, setAppealText] = useState("")

  async function handleDelete() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/products/${productId}`, { method: "DELETE" })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? "Ошибка удаления")
        return
      }
      router.push("/dashboard/products")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleResubmit() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/scan?productId=${productId}`, { method: "POST" })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? "Ошибка")
        return
      }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleAppeal() {
    if (!appealText.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `Обжалование: ${productTitle}`,
          category: "APPEAL",
          text: appealText.trim(),
          productId,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? `Ошибка сервера (${res.status})`)
        return
      }
      const data = await res.json()
      router.push(`/support/${data.id}`)
    } finally {
      setLoading(false)
    }
  }

  if (productStatus === "APPROVED") {
    return (
      <a
        href={`/product/${productSlug}`}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Открыть в каталоге →
      </a>
    )
  }

  if (productStatus === "DRAFT") {
    return (
      <div className="flex flex-wrap gap-3 items-center">
        <Button onClick={handleResubmit} disabled={loading}>
          {loading ? "Отправляем…" : "Отправить на проверку"}
        </Button>

        {!confirmDelete ? (
          <Button
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10"
            onClick={() => setConfirmDelete(true)}
            disabled={loading}
          >
            Удалить
          </Button>
        ) : (
          <>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? "Удаляем…" : "Подтвердить удаление"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={loading}>
              Отмена
            </Button>
          </>
        )}

        {error && <p className="text-sm text-red-500 w-full">{error}</p>}
      </div>
    )
  }

  if (productStatus === "REJECTED" || productStatus === "SUSPENDED") {
    return (
      <div className="space-y-4">
        {!showAppeal ? (
          <div className="flex flex-wrap gap-3 items-center">
            <Button
              variant="outline"
              onClick={() => setShowAppeal(true)}
              disabled={loading}
            >
              Обжаловать решение
            </Button>

            {productStatus === "REJECTED" && (
              !confirmDelete ? (
                <Button
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmDelete(true)}
                  disabled={loading}
                >
                  Удалить продукт
                </Button>
              ) : (
                <>
                  <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                    {loading ? "Удаляем…" : "Подтвердить удаление"}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={loading}>
                    Отмена
                  </Button>
                </>
              )
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h3 className="text-sm font-medium">Обжалование решения</h3>
            <p className="text-xs text-muted-foreground">
              Опишите, почему вы не согласны с решением. Модератор рассмотрит обращение в течение 1–2 рабочих дней.
            </p>
            <Textarea
              placeholder="Подробно объясните вашу позицию..."
              value={appealText}
              onChange={(e) => setAppealText(e.target.value)}
              rows={4}
              autoFocus
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-3">
              <Button
                onClick={handleAppeal}
                disabled={loading || !appealText.trim()}
              >
                {loading ? "Отправляем…" : "Отправить обращение"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setShowAppeal(false); setAppealText(""); setError(null) }}
                disabled={loading}
              >
                Отмена
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}
