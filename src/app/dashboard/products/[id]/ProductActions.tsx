"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface Props {
  productId: string
  productStatus: string
  productSlug: string
}

export function ProductActions({ productId, productStatus, productSlug }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

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
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
              disabled={loading}
            >
              Отмена
            </Button>
          </>
        )}

        {error && <p className="text-sm text-red-500 w-full">{error}</p>}
      </div>
    )
  }

  if (productStatus === "REJECTED") {
    return (
      <div className="flex flex-wrap gap-3 items-center">
        {!confirmDelete ? (
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
        )}
        {error && <p className="text-sm text-red-500 w-full">{error}</p>}
      </div>
    )
  }

  return null
}
