"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { reachGoal } from "@/lib/metrica"
import { formatPrice } from "@/lib/utils"
import { SERVICE_DISCLAIMER } from "@/lib/services"

interface Props {
  kindSlug: string
  price: number
  briefLabel: string
  briefRequired: boolean
  showFile: boolean
  fileRequired: boolean
  goal: string
}

export function OrderForm({ kindSlug, price, briefLabel, briefRequired, showFile, fileRequired, goal }: Props) {
  const [brief, setBrief] = useState("")
  const [contact, setContact] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function submit() {
    setError(null)
    if (briefRequired && brief.trim().length < 10) { setError("Опишите задачу подробнее"); return }
    if (fileRequired && !file) { setError("Прикрепите код (.py или .zip)"); return }
    if (!consent) { setError("Нужно согласие с условиями оферты"); return }

    setLoading(true)
    try {
      const fd = new FormData()
      fd.set("kind", kindSlug)
      fd.set("brief", brief)
      if (contact.trim()) fd.set("contact", contact.trim())
      if (file) fd.set("file", file)

      const res = await fetch("/api/services", { method: "POST", body: fd })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof d.error === "string" ? d.error : "Ошибка")
        return
      }
      reachGoal(goal)
      if (d.confirmationUrl) {
        window.location.href = d.confirmationUrl as string
      } else if (d.orderId) {
        window.location.href = `/services/${d.orderId}`
      }
    } catch {
      setError("Ошибка соединения")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-5">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          {briefLabel}{briefRequired && <span className="text-red-400"> *</span>}
        </label>
        <Textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={5} maxLength={5000} />
      </div>

      {showFile && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Код или архив{fileRequired && <span className="text-red-400"> *</span>}
            <span className="font-normal text-muted-foreground"> — .py или .zip, до 2 МБ</span>
          </label>
          <div
            onClick={() => fileRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-primary/50"
          >
            {file ? (
              <p className="text-sm font-medium text-primary">{file.name}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Нажмите, чтобы выбрать файл</p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".py,.zip"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Не загружайте действующие пароли — замените их перед отправкой. Код удаляется после сдачи отчёта.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          Контакт для связи <span className="font-normal text-muted-foreground">(необязательно)</span>
        </label>
        <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Telegram / телефон" maxLength={200} />
      </div>

      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
        <span>
          Соглашаюсь с условиями{" "}
          <Link href="/legal/offer" target="_blank" className="text-primary hover:underline">оферты</Link>{" "}
          и{" "}
          <Link href="/legal/consent-pd" target="_blank" className="text-primary hover:underline">обработкой персональных данных</Link>.
        </span>
      </label>

      <p className="text-xs text-muted-foreground">{SERVICE_DISCLAIMER}</p>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button onClick={submit} disabled={loading} size="lg" className="w-full">
        {loading ? "Переходим к оплате…" : `Перейти к оплате · ${formatPrice(price)}`}
      </Button>
    </div>
  )
}
