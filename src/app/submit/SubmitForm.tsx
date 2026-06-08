"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { StepIndicator } from "@/components/submit/StepIndicator"
import { CategoryStep } from "@/components/submit/steps/CategoryStep"
import { DescriptionStep } from "@/components/submit/steps/DescriptionStep"
import { FeaturesStep } from "@/components/submit/steps/FeaturesStep"
import { MediaStep } from "@/components/submit/steps/MediaStep"
import { PricingStep } from "@/components/submit/steps/PricingStep"
import { Button } from "@/components/ui/button"
import type { Category } from "@/types"

interface FormState {
  category: Category | ""
  title: string
  shortDesc: string
  fullDesc: string
  targetAudience: string
  techStack: string
  features: string[]
  productFile: File | null
  screenshots: File[]
  demoUrl: string
  videoUrl: string
  price: string
  license: string
  telegramBotUsername: string
}

const INITIAL: FormState = {
  category: "",
  title: "", shortDesc: "", fullDesc: "",
  targetAudience: "", techStack: "",
  features: [],
  productFile: null, screenshots: [], demoUrl: "", videoUrl: "",
  price: "", license: "personal", telegramBotUsername: "",
}

export function SubmitForm() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(INITIAL)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function canAdvance(): boolean {
    if (step === 0) return form.category !== ""
    if (step === 1) return form.title.length >= 5 && form.shortDesc.length >= 10 && form.fullDesc.length >= 30
    if (step === 2) return form.features.length >= 1
    if (step === 3) return form.productFile !== null
    return true
  }

  function advanceHint(): string | null {
    if (step === 1) {
      if (form.title.length < 5) return `Название: нужно ещё ${5 - form.title.length} симв.`
      if (form.shortDesc.length < 10) return `Краткое описание: нужно ещё ${10 - form.shortDesc.length} симв.`
      if (form.fullDesc.length < 30) return `Полное описание: нужно ещё ${30 - form.fullDesc.length} симв.`
    }
    if (step === 2 && form.features.length === 0) return "Добавьте хотя бы одну функцию"
    if (step === 3 && !form.productFile) return "Загрузите файл продукта"
    return null
  }

  async function handleSubmit() {
    if (!form.category) return
    setError(null)
    setLoading(true)
    try {
      // 1. Create product draft
      const priceKopecks = Math.round(parseFloat(form.price) * 100)
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          shortDesc: form.shortDesc,
          fullDesc: form.fullDesc,
          category: form.category,
          price: priceKopecks,
          features: form.features,
          targetAudience: form.targetAudience || undefined,
          techStack: form.techStack || undefined,
          license: form.license,
          telegramBotUsername: form.telegramBotUsername || undefined,
          demoUrl: form.demoUrl || undefined,
          videoUrl: form.videoUrl || undefined,
        }),
      })
      const product = await res.json()
      if (!res.ok) {
        setError(product.error?.message ?? "Ошибка создания продукта")
        return
      }

      const productId: string = product.id

      // 2. Upload product file
      if (form.productFile) {
        await uploadFile(productId, form.productFile, "source")
      }

      // 3. Upload screenshots
      for (let i = 0; i < form.screenshots.length; i++) {
        await uploadFile(productId, form.screenshots[i], "screenshot", i)
      }

      // 4. Trigger scan
      await fetch(`/api/scan?productId=${productId}`, { method: "POST" })

      router.push(`/dashboard/products?submitted=${productId}`)
    } catch {
      setError("Произошла ошибка. Попробуйте ещё раз.")
    } finally {
      setLoading(false)
    }
  }

  async function uploadFile(
    productId: string,
    file: File,
    type: "source" | "screenshot",
    screenshotIndex?: number,
  ) {
    const urlRes = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        type,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type || "application/octet-stream",
        screenshotIndex,
      }),
    })
    const { url } = await urlRes.json()
    if (!url) return
    await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <StepIndicator current={step} />
      </div>

      <div className="min-h-64">
        {step === 0 && (
          <CategoryStep
            value={form.category}
            onChange={(v) => setForm({ ...form, category: v })}
          />
        )}
        {step === 1 && (
          <DescriptionStep
            value={{ title: form.title, shortDesc: form.shortDesc, fullDesc: form.fullDesc, targetAudience: form.targetAudience, techStack: form.techStack }}
            onChange={(v) => setForm({ ...form, ...v })}
          />
        )}
        {step === 2 && (
          <FeaturesStep
            value={form.features}
            onChange={(v) => setForm({ ...form, features: v })}
          />
        )}
        {step === 3 && (
          <MediaStep
            value={{ productFile: form.productFile, screenshots: form.screenshots, demoUrl: form.demoUrl, videoUrl: form.videoUrl }}
            onChange={(v) => setForm({ ...form, ...v })}
          />
        )}
        {step === 4 && (
          <PricingStep
            value={{ price: form.price, license: form.license, telegramBotUsername: form.telegramBotUsername }}
            category={form.category}
            onChange={(v) => setForm({ ...form, ...v })}
          />
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep(step - 1)}
          disabled={step === 0 || loading}
        >
          Назад
        </Button>

        {step < 4 ? (
          <div className="flex flex-col items-end gap-1">
            {advanceHint() && (
              <p className="text-xs text-muted-foreground">{advanceHint()}</p>
            )}
            <Button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance()}
            >
              Далее
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !form.price || !form.productFile}
          >
            {loading ? "Отправляем…" : "Отправить на модерацию"}
          </Button>
        )}
      </div>
    </div>
  )
}
