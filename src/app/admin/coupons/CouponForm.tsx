"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function CouponForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [code,        setCode]        = useState("")
  const [discountPct, setDiscountPct] = useState("")
  const [maxUses,     setMaxUses]     = useState("")
  const [expiresAt,   setExpiresAt]   = useState("")

  function reset() {
    setCode("")
    setDiscountPct("")
    setMaxUses("")
    setExpiresAt("")
    setError(null)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const discount = parseInt(discountPct)
    if (!code.trim() || isNaN(discount) || discount < 1 || discount > 100) {
      setError("Введите код и корректный процент скидки (1–100)")
      return
    }

    startTransition(async () => {
      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          discountPct: discount,
          maxUses: maxUses ? parseInt(maxUses) : null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(typeof data.error === "string" ? data.error : "Ошибка создания купона")
        return
      }

      reset()
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Код купона</label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="SUMMER20"
            maxLength={32}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Скидка %</label>
          <Input
            type="number"
            value={discountPct}
            onChange={(e) => setDiscountPct(e.target.value)}
            placeholder="20"
            min={1}
            max={100}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Макс. использований</label>
          <Input
            type="number"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="Без ограничений"
            min={1}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Действует до</label>
          <Input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Создание..." : "Создать купон"}
      </Button>
    </form>
  )
}
