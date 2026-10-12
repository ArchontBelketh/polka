"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { reachGoal } from "@/lib/metrica"

const PLATFORMS = ["MAX", "Telegram", "VK", "Сайт", "Excel / таблицы", "1С", "CRM", "Другое"]
const BUDGETS = ["до 5 000 ₽", "5–15 тыс. ₽", "15–50 тыс. ₽", "больше 50 тыс. ₽", "не знаю"]

export function RequestForm() {
  const [f, setF] = useState({
    task: "", platform: "", deadline: "", budget: "", contact: "", messenger: "",
    consentPd: false, consentContacts: false,
  })
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((p) => ({ ...p, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!f.consentPd || !f.consentContacts) {
      setError("Нужно отметить оба согласия")
      return
    }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.set("task", f.task)
      fd.set("platform", f.platform)
      if (f.deadline) fd.set("deadline", f.deadline)
      if (f.budget) fd.set("budget", f.budget)
      fd.set("contact", f.contact)
      if (f.messenger) fd.set("messenger", f.messenger)
      fd.set("consentPd", String(f.consentPd))
      fd.set("consentContacts", String(f.consentContacts))
      if (file) fd.set("file", file)
      const res = await fetch("/api/requests", { method: "POST", body: fd })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof d.error === "string" ? d.error : "Ошибка отправки")
        return
      }
      setSent(true)
      reachGoal("request_sent")
    } catch {
      setError("Ошибка соединения")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-6 text-center space-y-2">
        <p className="text-lg font-semibold text-green-400">Задача отправлена</p>
        <p className="text-sm text-muted-foreground">Ответим в течение 24 часов на указанный контакт.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="task">Что нужно сделать *</Label>
        <Textarea
          id="task"
          rows={5}
          value={f.task}
          onChange={(e) => set("task", e.target.value)}
          placeholder="Например: Telegram-бот для записи клиентов с напоминаниями и выгрузкой в Google Sheets"
          maxLength={5000}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Где должно работать *</Label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => set("platform", p)}
              className={`h-9 px-3 rounded-md border text-sm transition-colors ${
                f.platform === p ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="deadline">Срок</Label>
          <Input id="deadline" value={f.deadline} onChange={(e) => set("deadline", e.target.value)} placeholder="дата или «не срочно»" maxLength={100} />
        </div>
        <div className="space-y-2">
          <Label>Бюджет</Label>
          <select
            value={f.budget}
            onChange={(e) => set("budget", e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">—</option>
            {BUDGETS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contact">Контакт * <span className="font-normal text-muted-foreground">(телефон или email)</span></Label>
          <Input id="contact" value={f.contact} onChange={(e) => set("contact", e.target.value)} placeholder="you@example.com или +7…" maxLength={200} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="messenger">Удобный мессенджер</Label>
          <Input id="messenger" value={f.messenger} onChange={(e) => set("messenger", e.target.value)} placeholder="Telegram / WhatsApp / MAX" maxLength={100} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Код или архив <span className="font-normal text-muted-foreground">(необязательно, .py/.zip до 2 МБ — проверим X-Ray)</span></Label>
        <div
          onClick={() => fileRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-5 text-center hover:border-primary/50 transition-colors"
        >
          {file ? (
            <p className="text-sm font-medium text-primary">{file.name}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Прикрепить файл (.py или .zip)</p>
          )}
          <input ref={fileRef} type="file" accept=".py,.zip" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
      </div>

      <div className="space-y-2.5 pt-1">
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" checked={f.consentPd} onChange={(e) => set("consentPd", e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="text-muted-foreground">
            Согласен на обработку персональных данных (
            <Link href="/legal/consent-pd" target="_blank" className="text-primary hover:underline">согласие</Link>).
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" checked={f.consentContacts} onChange={(e) => set("consentContacts", e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="text-muted-foreground">
            Согласен на передачу моих контактов отобранным исполнителям (
            <Link href="/legal/consent-contacts" target="_blank" className="text-primary hover:underline">согласие</Link>).
          </span>
        </label>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button type="submit" size="lg" disabled={loading || !f.task || !f.platform || !f.contact}>
        {loading ? "Отправляем…" : "Отправить задачу"}
      </Button>
    </form>
  )
}
