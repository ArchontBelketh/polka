"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SPECIALIZATIONS, jobFields } from "@/lib/jobs/policy"
import { priceInKopecks } from "@/lib/catalog-query"
import { jobFetch, jobInputClass } from "./client"

type Initial = { id: string; title: string; description: string; outcome: string; specialization: string; budgetMin: number; budgetMax: number; deadline: Date | string; revision: number }
const MARKER = "cyberpolka.pending-job"
export function JobForm({ initial }: { initial?: Initial }) {
  const router = useRouter(), inFlight = useRef(false), operation = useRef<string | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [recovery, setRecovery] = useState<string | null>(null)
  useEffect(() => {
    if (initial) return
    try {
      const id = sessionStorage.getItem(MARKER)
      if (id && /^[0-9a-f-]{36}$/i.test(id)) { operation.current = id; setRecovery(id) }
    } catch { /* Storage is optional; the mounted form keeps its UUID. */ }
  }, [initial])
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current) return
    const form = new FormData(event.currentTarget)
    let deadline: string
    try { deadline = new Date(`${form.get("deadline")}T23:59:00`).toISOString() } catch { setError("Укажите корректный срок"); return }
    const fields = jobFields.safeParse({ title: form.get("title"), description: form.get("description"), outcome: form.get("outcome"), specialization: form.get("specialization"), budgetMin: priceInKopecks(String(form.get("budgetMin"))), budgetMax: priceInKopecks(String(form.get("budgetMax"))), deadline })
    if (!fields.success) { setError(fields.error.issues[0].message); return }
    inFlight.current = true; setBusy(true); setError("")
    try {
      if (initial) await jobFetch(`/api/orders/${initial.id}`, { action: "EDIT", revision: initial.revision, fields: fields.data })
      else {
        operation.current ??= crypto.randomUUID()
        try { sessionStorage.setItem(MARKER, operation.current) } catch { /* Optional recovery marker. */ }
        await jobFetch("/api/orders", { id: operation.current, fields: fields.data })
        try { sessionStorage.removeItem(MARKER) } catch { /* Optional recovery marker. */ }
      }
      router.push(`/orders/${initial?.id ?? operation.current}`); router.refresh()
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Не удалось сохранить заказ") }
    finally { inFlight.current = false; setBusy(false) }
  }
  if (recovery && !initial) return <div className="rounded-xl border border-border bg-card p-5 space-y-4"><h2 className="font-semibold">Проверьте предыдущий черновик</h2><p className="text-sm text-muted-foreground">Отправка могла завершиться до потери ответа. Откройте заказ или проверьте список в кабинете.</p><div className="flex flex-wrap gap-3"><Button asChild><Link href={`/orders/${recovery}`}>Открыть заказ</Link></Button><Button asChild variant="outline"><Link href="/dashboard/orders">Мои заказы</Link></Button><Button variant="outline" onClick={() => { try { sessionStorage.removeItem(MARKER) } catch {} operation.current = null; setRecovery(null) }}>Создать другой заказ</Button></div></div>
  return <form onSubmit={submit} className="space-y-5">
    <p className="text-sm text-muted-foreground">Описание и результат станут публичными после модерации. Не указывайте контакты, пароли и данные клиентов. Черновик виден вам и модераторам.</p>
    <fieldset disabled={busy} className="space-y-5 min-w-0">
      <div className="space-y-2"><label htmlFor="job-title" className="text-sm">Название задачи</label><input id="job-title" name="title" className={jobInputClass} defaultValue={initial?.title} minLength={8} maxLength={140} required /></div>
      <div className="space-y-2"><label htmlFor="job-specialization" className="text-sm">Специализация</label><select id="job-specialization" name="specialization" className={jobInputClass} defaultValue={initial?.specialization ?? "SCRIPTS"}>{Object.entries(SPECIALIZATIONS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></div>
      <div className="space-y-2"><label htmlFor="job-description" className="text-sm">Описание задачи</label><textarea id="job-description" name="description" className={jobInputClass} defaultValue={initial?.description} rows={7} minLength={50} maxLength={15000} required /></div>
      <div className="space-y-2"><label htmlFor="job-outcome" className="text-sm">Ожидаемый результат и критерии приёмки</label><textarea id="job-outcome" name="outcome" className={jobInputClass} defaultValue={initial?.outcome} rows={4} minLength={20} maxLength={4000} required /></div>
      <div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><label htmlFor="job-min" className="text-sm">Бюджет от, ₽</label><input id="job-min" name="budgetMin" className={jobInputClass} inputMode="decimal" defaultValue={initial ? initial.budgetMin / 100 : ""} required /></div><div className="space-y-2"><label htmlFor="job-max" className="text-sm">Бюджет до, ₽</label><input id="job-max" name="budgetMax" className={jobInputClass} inputMode="decimal" defaultValue={initial ? initial.budgetMax / 100 : ""} required /></div><div className="space-y-2"><label htmlFor="job-deadline" className="text-sm">Желаемый срок</label><input id="job-deadline" type="date" name="deadline" className={jobInputClass} defaultValue={initial ? new Date(initial.deadline).toISOString().slice(0, 10) : ""} required /></div></div>
      <p className="text-xs text-muted-foreground">Размещение и отклики бесплатны. Порядок расчётов согласуйте с исполнителем отдельно; приёмка на сайте фиксирует результат работы.</p>
      <Button type="submit" disabled={busy}>{busy ? "Сохраняем…" : initial ? "Сохранить изменения" : "Сохранить черновик"}</Button>
    </fieldset>
    {error && <div role="alert" className="text-sm text-red-400 break-words">{error} <Link href="/dashboard/orders" className="underline">Проверить мои заказы</Link></div>}
  </form>
}
