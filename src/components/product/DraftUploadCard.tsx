"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { uploadProductFile } from "@/lib/product-upload"

export function DraftUploadCard({ productId, sourceConfirmed, sourceName, screenshotCount }: {
  productId: string; sourceConfirmed: boolean; sourceName?: string; screenshotCount: number
}) {
  const [source, setSource] = useState<File | null>(null)
  const [images, setImages] = useState<File[]>([])
  const [start, setStart] = useState(Math.min(screenshotCount, 4))
  const [confirmed, setConfirmed] = useState(sourceConfirmed)
  const [pending, setPending] = useState(false)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState("")
  const router = useRouter()

  async function transfer(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return
    if (images.length > 5 - start) { setError("Для выбранной позиции слишком много скриншотов. Всего может быть до пяти."); return }
    setPending(true); setError(""); setProgress("")
    try {
      if (source) { setProgress("Загружаем исходный файл…"); await uploadProductFile(productId, source, "source"); setConfirmed(true) }
      for (let index = 0; index < images.length; index++) { setProgress(`Загружаем скриншот ${index + 1} из ${images.length}…`); await uploadProductFile(productId, images[index], "screenshot", start + index) }
      setProgress("Загрузка подтверждена. Можно отправить товар на модерацию.")
      router.refresh()
    } catch (error) { setError(error instanceof Error ? error.message : "Не удалось загрузить файл. Повторите попытку."); setProgress("") }
    finally { setPending(false) }
  }

  async function submit() {
    if (pending) return
    setPending(true); setError("")
    try {
      const response = await fetch(`/api/scan?productId=${encodeURIComponent(productId)}`, { method: "POST" })
      const result = await response.json().catch(() => ({}))
      if (!response.ok && !(response.status === 409 && result.code === "ALREADY_SUBMITTED")) { setError(typeof result.error === "string" ? result.error : "Не удалось отправить товар на проверку"); return }
      router.refresh()
    } catch { setError("Не удалось подтвердить отправку. Обновите страницу и проверьте статус товара.") }
    finally { setPending(false) }
  }
  return <section className="space-y-5 rounded-2xl border border-border bg-card/40 p-4 sm:p-6" aria-labelledby="draft-upload-title"><div><h2 id="draft-upload-title" className="text-lg font-semibold">Файлы черновика</h2><p className="mt-1 text-sm text-muted-foreground">Продолжите загрузку после сбоя. Исходный файл станет доступен для проверки только после подтверждения на сервере.</p></div><p className="break-words text-sm">{confirmed ? `Исходный файл подтверждён${sourceName ? `: ${sourceName}` : ""}` : "Подтверждённого исходного файла пока нет"}</p>
    <form onSubmit={transfer} className="space-y-4" aria-label="Загрузка файлов черновика"><fieldset disabled={pending} className="min-w-0 space-y-4"><legend className="sr-only">Выбор файлов</legend><div className="space-y-2"><label htmlFor="draft-source" className="text-sm font-medium">{confirmed ? "Заменить исходный файл" : "Исходный файл"}</label><Input id="draft-source" type="file" accept=".zip,.py,.js,.ts,.epf,.erf,.xlsm,.xls" onChange={(event) => setSource(event.target.files?.[0] ?? null)} className="h-auto py-2" /><p className="text-xs text-muted-foreground">До 100 МБ. Новый подтверждённый файл заменит исходник в этом черновике.</p></div><div className="space-y-2"><label htmlFor="draft-images" className="text-sm font-medium">Скриншоты</label><Input id="draft-images" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => setImages(Array.from(event.target.files ?? []))} className="h-auto py-2" /><p className="text-xs text-muted-foreground">До 5 изображений, каждое до 5 МБ. Сохранено: {screenshotCount}.</p></div>{screenshotCount > 0 && <div className="space-y-2"><label htmlFor="draft-image-start" className="text-sm font-medium">Позиция первого выбранного скриншота</label><select id="draft-image-start" value={start} onChange={(event) => setStart(Number(event.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">{Array.from({ length: Math.min(screenshotCount + 1, 5) }, (_, index) => <option key={index} value={index}>{index === screenshotCount ? "Добавить после сохранённых" : `Заменить начиная со скриншота ${index + 1}`}</option>)}</select></div>}</fieldset><Button type="submit" variant="outline" disabled={pending || (!source && !images.length)}>{pending ? "Загрузка…" : "Загрузить выбранные файлы"}</Button></form>
    {progress && <p role="status" className="text-sm text-cyan">{progress}</p>}{error && <p role="alert" className="text-sm text-red-400">{error}</p>}<Button type="button" onClick={submit} disabled={pending || !confirmed}>Отправить на модерацию</Button>
  </section>
}
