"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ProductSpecificationFields } from "./ProductSpecificationFields"
import { Button } from "@/components/ui/button"
import type { ProductSpecificationInput } from "@/lib/product-specification"

export function ProductSpecificationEditor({ productId, initial }: { productId: string; initial: ProductSpecificationInput }) {
  const [value, setValue] = useState(initial)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const router = useRouter()
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true); setMessage(""); setError("")
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/specification`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { setError(typeof data.error === "string" ? data.error : "Не удалось сохранить характеристики"); return }
      setMessage("Характеристики сохранены")
      router.refresh()
    } catch { setError("Ошибка сети. Поля остались заполнены — попробуйте ещё раз.") }
    finally { setPending(false) }
  }
  return <form onSubmit={submit} onChange={() => setMessage("")} className="space-y-5 rounded-2xl border border-border bg-card/40 p-4 sm:p-6" aria-label="Характеристики товара"><fieldset disabled={pending} className="min-w-0"><legend className="sr-only">Редактирование характеристик</legend><ProductSpecificationFields value={value} onChange={setValue} idPrefix="owner-spec" /></fieldset><p className="text-xs text-muted-foreground">После отправки товара на модерацию редактирование закрывается до решения модератора.</p><Button type="submit" disabled={pending}>{pending ? "Сохранение…" : "Сохранить характеристики"}</Button>{message && <p role="status" className="text-sm text-green-400">{message}</p>}{error && <p role="alert" className="text-sm text-red-400">{error}</p>}</form>
}
