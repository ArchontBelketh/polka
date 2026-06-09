"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { AiReviewCard } from "./AiReviewCard"
import type { AiReviewResult } from "@/lib/ai-review/prompt"

interface ExistingReview {
  id: string
  status: string
  result: AiReviewResult | null
  createdAt: string
}

interface Props {
  productId: string
  existingReview: ExistingReview | null
}


export function AiReviewOrder({ productId, existingReview }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function order() {
    startTransition(async () => {
      setError(null)
      const res = await fetch("/api/ai-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      })
      const data = await res.json() as { confirmationUrl?: string; error?: string }
      if (!res.ok) { setError(data.error ?? "Ошибка"); return }
      if (data.confirmationUrl) window.location.replace(data.confirmationUrl)
    })
  }

  // Completed review — show result
  if (existingReview?.status === "DONE" && existingReview.result) {
    return (
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm">AI-ревью кода</h2>
        <AiReviewCard result={existingReview.result} createdAt={existingReview.createdAt} />
      </section>
    )
  }

  // Processing — show progress message only
  if (existingReview?.status === "PROCESSING") {
    return (
      <section className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-1">
        <p className="text-sm font-medium">AI-ревью кода</p>
        <p className="text-xs text-muted-foreground">
          Анализируется… Обычно занимает несколько минут. Результат появится в разделе «Мои AI-ревью».
        </p>
      </section>
    )
  }

  // PENDING / FAILED / no review — show order form
  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-3">
      <div className="space-y-1">
        <h2 className="font-semibold text-sm">AI-ревью кода</h2>
        <p className="text-xs text-muted-foreground">
          Независимый аудит: качество кода, безопасность, соответствие описанию, скрытые требования.
        </p>
      </div>
      {existingReview?.status === "FAILED" && (
        <p className="text-xs text-destructive">Предыдущий анализ завершился с ошибкой. Вы можете попробовать снова.</p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">₽ 390</span>
        <Button size="sm" onClick={order} disabled={isPending}>
          {isPending ? "Переход к оплате…" : "Заказать ревью"}
        </Button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </section>
  )
}
