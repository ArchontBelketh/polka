"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { REQUEST_STATUS_LABELS, REQUEST_STATUSES } from "@/lib/request-status"
import { PASSPORT_TEMPLATE } from "@/lib/relay"

interface Props {
  requestId: string
  status: string
  notes: string
  spec: string
  kworkUrl: string
  projectPassport: string
}

const SPEC_TEMPLATE = `## Задача

## Где должно работать

## Что должно получиться

## Критерии приёмки
-
-

## Срок
`

export function RequestActions({ requestId, status, notes, spec, kworkUrl, projectPassport }: Props) {
  const router = useRouter()
  const [newStatus, setNewStatus] = useState(status)
  const [comment, setComment] = useState("")
  const [notesVal, setNotesVal] = useState(notes)
  const [specVal, setSpecVal] = useState(spec || SPEC_TEMPLATE)
  const [kwork, setKwork] = useState(kworkUrl)
  const [passport, setPassport] = useState(projectPassport)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save() {
    setLoading(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/admin/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          comment: comment || undefined,
          notes: notesVal,
          spec: specVal,
          projectPassport: passport,
          kworkUrl: newStatus === "KWORK" ? kwork : undefined,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof d.error === "string" ? d.error : "Ошибка")
        return
      }
      setComment("")
      setSaved(true)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
      <h2 className="font-semibold">Управление заявкой</h2>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Статус</label>
        <select
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value)}
          className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {REQUEST_STATUSES.map((s) => (
            <option key={s} value={s}>{REQUEST_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {newStatus === "KWORK" && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Ссылка Kwork (отправлена заказчику)</label>
          <Input value={kwork} onChange={(e) => setKwork(e.target.value)} placeholder="https://kwork.ru/…" maxLength={500} />
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Комментарий к смене статуса <span className="font-normal text-muted-foreground">(в историю)</span></label>
        <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="необязательно" maxLength={500} />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Техническое задание <span className="font-normal text-muted-foreground">(заполняет оператор)</span></label>
        <Textarea value={specVal} onChange={(e) => setSpecVal(e.target.value)} rows={10} maxLength={10000} className="font-mono text-xs" />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-medium">Паспорт проекта <span className="font-normal text-muted-foreground">(нужен для закрытия заявки)</span></label>
          {!passport.trim() && (
            <button type="button" onClick={() => setPassport(PASSPORT_TEMPLATE)} className="text-xs text-primary hover:underline">
              Вставить шаблон
            </button>
          )}
        </div>
        <Textarea value={passport} onChange={(e) => setPassport(e.target.value)} rows={10} maxLength={20000} className="font-mono text-xs" />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Заметки (внутренние)</label>
        <Textarea value={notesVal} onChange={(e) => setNotesVal(e.target.value)} rows={4} maxLength={5000} />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-green-500">Сохранено.</p>}

      <Button onClick={save} disabled={loading}>{loading ? "Сохранение…" : "Сохранить"}</Button>
    </section>
  )
}
