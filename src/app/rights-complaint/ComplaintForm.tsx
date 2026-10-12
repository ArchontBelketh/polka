"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

export function ComplaintForm() {
  const [f, setF] = useState({
    claimant: "", contact: "", productUrl: "", protectedObj: "", rightsProof: "", description: "",
    consentPd: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((p) => ({ ...p, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!f.consentPd) { setError("Нужно согласие на обработку данных"); return }
    setLoading(true)
    try {
      const res = await fetch("/api/rights-complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimant: f.claimant,
          contact: f.contact,
          productUrl: f.productUrl || undefined,
          protectedObj: f.protectedObj,
          rightsProof: f.rightsProof,
          description: f.description,
          consentPd: f.consentPd,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof d.error === "string" ? d.error : "Ошибка отправки")
        return
      }
      setSent(true)
    } catch {
      setError("Ошибка соединения")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-6 text-center space-y-2">
        <p className="text-lg font-semibold text-green-400">Обращение отправлено</p>
        <p className="text-sm text-muted-foreground">Мы рассмотрим его и сообщим решение на указанный контакт.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="claimant">Заявитель (ФИО или наименование) *</Label>
        <Input id="claimant" value={f.claimant} onChange={(e) => set("claimant", e.target.value)} maxLength={300} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact">Контакт для ответа * <span className="font-normal text-muted-foreground">(email)</span></Label>
        <Input id="contact" value={f.contact} onChange={(e) => set("contact", e.target.value)} maxLength={200} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="productUrl">Ссылка на продукт</Label>
        <Input id="productUrl" value={f.productUrl} onChange={(e) => set("productUrl", e.target.value)} placeholder="https://cyberpolka.store/product/…" maxLength={500} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="protectedObj">Охраняемый объект *</Label>
        <Textarea id="protectedObj" rows={2} value={f.protectedObj} onChange={(e) => set("protectedObj", e.target.value)} placeholder="Что именно принадлежит вам (программа, код, товарный знак и т. п.)" maxLength={2000} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rightsProof">Подтверждение прав *</Label>
        <Textarea id="rightsProof" rows={3} value={f.rightsProof} onChange={(e) => set("rightsProof", e.target.value)} placeholder="Свидетельство о регистрации, депонирование, договор, сведения о первой публикации — реквизиты или ссылки" maxLength={2000} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Описание нарушения *</Label>
        <Textarea id="description" rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={5000} required />
      </div>

      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" checked={f.consentPd} onChange={(e) => set("consentPd", e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="text-muted-foreground">
          Согласен на обработку персональных данных (
          <Link href="/legal/consent-pd" target="_blank" className="text-primary hover:underline">согласие</Link>) и подтверждаю достоверность сведений.
        </span>
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button type="submit" size="lg" disabled={loading || !f.claimant || !f.contact}>
        {loading ? "Отправляем…" : "Отправить жалобу"}
      </Button>
    </form>
  )
}
