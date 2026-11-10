"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { StepIndicator } from "@/components/submit/StepIndicator"
import { CategoryStep } from "@/components/submit/steps/CategoryStep"
import { DescriptionStep } from "@/components/submit/steps/DescriptionStep"
import { FeaturesStep } from "@/components/submit/steps/FeaturesStep"
import { InstallStep } from "@/components/submit/steps/InstallStep"
import { MediaStep } from "@/components/submit/steps/MediaStep"
import { PricingStep } from "@/components/submit/steps/PricingStep"
import { Button } from "@/components/ui/button"
import type { Category } from "@/types"
import { ProductSpecificationFields } from "@/components/product/ProductSpecificationFields"
import { specificationInput, productSpecificationSchema, type ProductSpecificationInput } from "@/lib/product-specification"
import { uploadProductFile } from "@/lib/product-upload"
import { priceInKopecks } from "@/lib/catalog-query"

interface FormState {
  specification: ProductSpecificationInput
  category: Category | ""
  title: string
  shortDesc: string
  fullDesc: string
  targetAudience: string
  techStack: string[]
  features: string[]
  installGuide: string
  requirements: string[]
  xrayDeclInternet: boolean
  xrayDeclFiles: boolean
  xrayDeclCommands: boolean
  productFile: File | null
  screenshots: File[]
  demoUrl: string
  videoUrl: string
  exampleInput: string
  exampleOutput: string
  price: string
  license: string
  telegramBotUsername: string
  developerPaymentInfo: string
}

const INITIAL: FormState = {
  specification: specificationInput(),
  category: "",
  title: "", shortDesc: "", fullDesc: "",
  targetAudience: "", techStack: [],
  features: [],
  installGuide: "", requirements: [],
  xrayDeclInternet: false, xrayDeclFiles: false, xrayDeclCommands: false,
  productFile: null, screenshots: [], demoUrl: "", videoUrl: "",
  exampleInput: "", exampleOutput: "",
  price: "", license: "personal", telegramBotUsername: "", developerPaymentInfo: "",
}

const MIN_GUIDE = 200
const RECOVERY_KEY = "cyberpolka.pending-product"

export function SubmitForm() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(INITIAL)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null)
  const [recovery, setRecovery] = useState<{ requestId: string; productId?: string } | null>(null)
  const [restoring, setRestoring] = useState(true)
  const requestId = useRef<string | null>(null)
  const inFlight = useRef(false)

  function remember(productId?: string) {
    try { sessionStorage.setItem(RECOVERY_KEY, JSON.stringify({ requestId: requestId.current, productId })) } catch { /* recovery is optional; retries still share the in-memory key */ }
  }
  async function checkRecovery(id: string) {
    setRestoring(true)
    try {
      const response = await fetch(`/api/product-submissions/${encodeURIComponent(id)}`, { cache: "no-store" })
      const result = await response.json().catch(() => ({}))
      setRecovery({ requestId: id, ...(response.ok && typeof result.productId === "string" ? { productId: result.productId } : {}) })
    } catch { setRecovery({ requestId: id }) }
    finally { setRestoring(false) }
  }
  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(RECOVERY_KEY) ?? "null")
      if (typeof stored?.requestId === "string") { requestId.current = stored.requestId; void checkRecovery(stored.requestId); return }
    } catch { /* no usable recovery marker */ }
    setRestoring(false)
  }, [])

  function canAdvance(): boolean {
    if (step === 0) return form.category !== ""
    if (step === 1) return form.title.length >= 5 && form.shortDesc.length >= 10 && form.fullDesc.length >= 30
    if (step === 2) return form.features.length >= 1
    if (step === 3) return form.installGuide.trim().length >= MIN_GUIDE && productSpecificationSchema.safeParse(form.specification).success
    if (step === 4) return form.productFile !== null
    return true
  }

  function advanceHint(): string | null {
    if (step === 1) {
      if (form.title.length < 5) return `Название: нужно ещё ${5 - form.title.length} симв.`
      if (form.shortDesc.length < 10) return `Краткое описание: нужно ещё ${10 - form.shortDesc.length} симв.`
      if (form.fullDesc.length < 30) return `Полное описание: нужно ещё ${30 - form.fullDesc.length} симв.`
    }
    if (step === 2 && form.features.length === 0) return "Добавьте хотя бы одну функцию"
    if (step === 3) {
      const len = form.installGuide.trim().length
      if (len < MIN_GUIDE) return `Инструкция: нужно ещё ${MIN_GUIDE - len} символов`
      if (!productSpecificationSchema.safeParse(form.specification).success) return "Проверьте характеристики товара"
    }
    if (step === 4 && !form.productFile) return "Загрузите файл продукта"
    return null
  }

  async function handleSubmit() {
    if (!form.category || inFlight.current) return
    const priceKopecks = priceInKopecks(form.price)
    if (priceKopecks === null || priceKopecks <= 0) { setError("Укажите положительную цену с точностью до копеек"); return }
    inFlight.current = true
    setError(null)
    setLoading(true)
    try {
      // One retry token covers creation, including an uncertain HTTP outcome.
      requestId.current ??= crypto.randomUUID()
      remember(savedDraftId ?? undefined)
      let productId = savedDraftId
      if (!productId) {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: requestId.current,
          title: form.title,
          shortDesc: form.shortDesc,
          fullDesc: form.fullDesc,
          category: form.category,
          price: priceKopecks,
          features: form.features,
          specification: form.specification,
          installGuide: form.installGuide,
          requirements: form.requirements.length > 0 ? form.requirements : undefined,
          targetAudience: form.targetAudience || undefined,
          techStack: form.techStack.length > 0 ? form.techStack : undefined,
          license: form.license,
          telegramBotUsername: form.telegramBotUsername || undefined,
          developerPaymentInfo: form.developerPaymentInfo || undefined,
          demoUrl: form.demoUrl || undefined,
          videoUrl: form.videoUrl || undefined,
          exampleInput: form.exampleInput || undefined,
          exampleOutput: form.exampleOutput || undefined,
          xrayDeclInternet: form.xrayDeclInternet,
          xrayDeclFiles: form.xrayDeclFiles,
          xrayDeclCommands: form.xrayDeclCommands,
        }),
      })
      const product = await res.json()
      if (!res.ok) {
        if (product.code === "SUBMISSION_CHANGED" && typeof product.productId === "string") { setSavedDraftId(product.productId); remember(product.productId) }
        setError(typeof product.error === "string" ? product.error : "Проверьте поля продукта: не удалось сохранить черновик")
        return
      }

      productId = product.id
      if (typeof productId !== "string") throw new Error("Не удалось определить сохранённый черновик")
      setSavedDraftId(productId)
      remember(productId)
      }

      // 2. Upload product file
      if (form.productFile) {
        await uploadProductFile(productId, form.productFile, "source")
      }

      // 3. Upload screenshots
      for (let i = 0; i < form.screenshots.length; i++) {
        await uploadProductFile(productId, form.screenshots[i], "screenshot", i)
      }

      // 4. Trigger scan (гейт: без реквизитов вернётся 403)
      const scanRes = await fetch(`/api/scan?productId=${productId}`, { method: "POST" })
      const d = await scanRes.json().catch(() => ({}))
      if (!scanRes.ok && !(scanRes.status === 409 && d.code === "ALREADY_SUBMITTED")) {
        if (d.code === "REQUISITES_REQUIRED") {
          setError("Продукт сохранён как черновик. Правовой статус и реквизиты нужны только для публикации и выплат — укажите их в разделе «Реквизиты», когда будете готовы продавать.")
          return
        }
        setError(typeof d.error === "string" ? d.error : "Не удалось отправить на проверку.")
        return
      }

      try { const marker = JSON.parse(sessionStorage.getItem(RECOVERY_KEY) ?? "null"); if (marker?.requestId === requestId.current) sessionStorage.removeItem(RECOVERY_KEY) } catch { /* optional browser recovery */ }
      router.push(`/dashboard/products?submitted=${productId}`)
    } catch (error) {
      setError(error instanceof TypeError ? "Ошибка сети. Повторите отправку или проверьте сохранённый черновик после обновления страницы." : error instanceof Error ? error.message : "Произошла ошибка. Попробуйте ещё раз.")
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }

  if (restoring) return <p role="status" className="text-sm text-muted-foreground">Проверяем сохранённый черновик…</p>
  if (recovery) return <section className="rounded-2xl border border-border bg-card p-6 space-y-4"><h2 className="text-xl font-semibold">Продолжить предыдущую загрузку</h2><p className="text-sm text-muted-foreground">{recovery.productId ? "Черновик уже сохранён. Откройте его в кабинете, чтобы продолжить загрузку и отправить товар на модерацию." : "Сохранение предыдущей попытки пока не подтверждено. Повторите проверку перед созданием другого товара."}</p><div className="flex flex-wrap gap-3">{recovery.productId ? <Button asChild><Link href={`/dashboard/products/${recovery.productId}`}>Открыть черновик</Link></Button> : <Button onClick={() => void checkRecovery(recovery.requestId)}>Проверить ещё раз</Button>}<Button variant="outline" onClick={() => { requestId.current = null; setRecovery(null); try { sessionStorage.removeItem(RECOVERY_KEY) } catch { /* optional storage */ } }}>Создать другой товар</Button></div></section>

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <StepIndicator current={step} />
      </div>

      <fieldset disabled={loading || !!savedDraftId} className="min-w-0 min-h-64"><legend className="sr-only">Данные товара</legend>
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
        {step === 3 && <div className="space-y-8">
          <InstallStep
            value={{
              installGuide: form.installGuide,
              requirements: form.requirements,
              xrayDeclInternet: form.xrayDeclInternet,
              xrayDeclFiles: form.xrayDeclFiles,
              xrayDeclCommands: form.xrayDeclCommands,
            }}
            onChange={(v) => setForm({ ...form, ...v })}
          />
          <ProductSpecificationFields value={form.specification} onChange={(value) => setForm({ ...form, specification: value })} idPrefix="submit-spec" />
        </div>}
        {step === 4 && (
          <MediaStep
            value={{ productFile: form.productFile, screenshots: form.screenshots, demoUrl: form.demoUrl, videoUrl: form.videoUrl, exampleInput: form.exampleInput, exampleOutput: form.exampleOutput }}
            onChange={(v) => setForm({ ...form, ...v })}
          />
        )}
        {step === 5 && (
          <PricingStep
            value={{ price: form.price, license: form.license, telegramBotUsername: form.telegramBotUsername, developerPaymentInfo: form.developerPaymentInfo }}
            category={form.category}
            onChange={(v) => setForm({ ...form, ...v })}
          />
        )}
      </fieldset>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {savedDraftId && <p className="text-sm text-muted-foreground">Черновик сохранён. <Link href={`/dashboard/products/${savedDraftId}`} className="text-cyan underline">Продолжить в кабинете</Link></p>}

      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep(step - 1)}
          disabled={step === 0 || loading || !!savedDraftId}
        >
          Назад
        </Button>

        {step < 5 ? (
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
            {loading ? "Отправляем…" : savedDraftId ? "Повторить отправку" : "Отправить на модерацию"}
          </Button>
        )}
      </div>
    </div>
  )
}
