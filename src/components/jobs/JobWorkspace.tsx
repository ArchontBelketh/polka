"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/utils"
import { JOB_STATUS_LABELS, ACTIVE_JOB_STATUSES } from "@/lib/jobs/policy"
import type { readWorkspace } from "@/lib/jobs/read"
import { jobFetch, jobInputClass, dateText } from "./client"

type View = Awaited<ReturnType<typeof readWorkspace>>
export function JobWorkspace({ initial, actorId, staff, storageAvailable }: { initial: View; actorId: string; staff: boolean; storageAvailable: boolean }) {
  const [view, setView] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState(""), [reason, setReason] = useState("")
  const guard = useRef(false), messageNonce = useRef<{ id: string; text: string } | null>(null), deliveryNonce = useRef<{ id: string; signature: string } | null>(null), uploadIds = useRef(new WeakMap<File, string>())
  const { job, contract } = view, customer = actorId === job.customerId, developer = actorId === contract.developerId
  const member = customer || developer, active = ACTIVE_JOB_STATUSES.includes(job.status), pending = view.deliveries.find(delivery => delivery.status === "PENDING")
  const working = member && job.publicationStatus === "APPROVED" && !job.cancellationRequestedBy
  async function reload() {
    const response = await fetch(`/api/orders/${job.id}/workspace`, { cache: "no-store" })
    const next = await response.json()
    if (!response.ok) throw new Error(next.error ?? "Не удалось обновить рабочую область")
    setView(next)
  }
  async function perform(work: () => Promise<void>) {
    if (guard.current) return; guard.current = true; setBusy(true); setError("")
    try { await work() } catch (problem) { setError(problem instanceof Error ? problem.message : "Ответ не получен. Обновите страницу.") }
    finally { guard.current = false; setBusy(false) }
  }
  const command = (body: unknown) => perform(async () => { await jobFetch(`/api/orders/${job.id}`, body); await reload() })
  return <div className="space-y-6 [&_button]:max-w-full [&_button]:whitespace-normal [&_button]:h-auto [&_button]:min-h-10">
    <div className="flex flex-wrap justify-between gap-4"><div><Link href={`/orders/${job.id}`} className="text-sm text-cyan hover:underline">← Описание заказа</Link><h1 className="mt-3 break-words text-2xl font-semibold">{job.title}</h1><p className="mt-2 text-sm text-muted-foreground">{JOB_STATUS_LABELS[job.status]}</p></div><Button variant="outline" disabled={busy} onClick={() => perform(reload)}>Обновить</Button></div>
    <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Рабочая область видна участникам и уполномоченной поддержке. Расчёты согласуются отдельно. Приёмка фиксирует результат работы и открывает отзывы.</p>
    {error && <p role="alert" className="rounded-xl border border-red-400/30 p-4 text-sm text-red-400 break-words">{error}</p>}
    <details className="rounded-xl border border-border bg-card p-5" open><summary className="font-semibold cursor-pointer">Согласованные условия</summary><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Стоимость предложения</dt><dd className="mt-1 font-semibold">{formatPrice(contract.amount)}</dd></div><div><dt className="text-muted-foreground">Срок после выбора</dt><dd className="mt-1">{contract.durationDays} дней · до {dateText(contract.dueAt)}</dd></div><div className="sm:col-span-2"><dt className="text-muted-foreground">Результат и критерии</dt><dd className="mt-1 whitespace-pre-wrap break-words">{contract.outcome}</dd></div><div className="sm:col-span-2"><dt className="text-muted-foreground">Предложение исполнителя</dt><dd className="mt-1 whitespace-pre-wrap break-words">{contract.approach}</dd></div><div className="sm:col-span-2"><dt className="text-muted-foreground">Описание задачи на момент выбора</dt><dd className="mt-1 whitespace-pre-wrap break-words">{contract.description}</dd></div></dl></details>

    {job.cancellationRequestedBy && <section className="rounded-xl border border-violet/40 bg-violet/5 p-5 space-y-3"><h2 className="font-semibold">Предложена отмена заказа</h2><p className="text-sm whitespace-pre-wrap break-words">{job.cancellationReason}</p>{member && <div className="flex flex-wrap gap-3">{job.cancellationRequestedBy === actorId ? <Button disabled={busy} variant="outline" onClick={() => command({ action: "WITHDRAW_CANCEL" })}>Отозвать запрос отмены</Button> : <><Button disabled={busy} variant="outline" onClick={() => command({ action: "CONFIRM_CANCEL" })}>Согласиться на отмену</Button><Button disabled={busy} variant="outline" onClick={() => command({ action: "DECLINE_CANCEL" })}>Продолжить заказ</Button></>}</div>}</section>}
    {job.status === "DISPUTED" && <section className="rounded-xl border border-violet/40 p-5 space-y-3"><h2 className="font-semibold">Спор передан поддержке</h2><p className="whitespace-pre-wrap break-words text-sm">{view.dispute?.reason}</p><p className="text-sm text-muted-foreground">Переписка остаётся доступной; сдача и приёмка приостановлены до решения.</p>{staff && <><label htmlFor="dispute-resolution" className="text-sm">Решение поддержки</label><textarea id="dispute-resolution" className={jobInputClass} value={reason} onChange={event => setReason(event.target.value)} rows={3} maxLength={2000} /><div className="flex flex-wrap gap-3"><Button disabled={busy || reason.trim().length < 10} onClick={() => command({ action: "RESUME", reason })}>Возобновить работу</Button><Button variant="outline" disabled={busy || reason.trim().length < 10} onClick={() => command({ action: "RESOLVE_CANCEL", reason })}>Завершить спор отменой</Button><Button asChild variant="outline"><Link href={`/support/${view.dispute?.ticketId}`}>Открыть обращение</Link></Button></div></>}</section>}
    {developer && working && job.status === "EXECUTOR_SELECTED" && <Button disabled={busy} onClick={() => command({ action: "START" })}>Начать работу по согласованным условиям</Button>}

    <section className="rounded-xl border border-border bg-card p-5 space-y-4"><h2 className="text-xl font-semibold">Файлы заказа</h2><p className="text-xs text-muted-foreground">Файлы доступны только участникам и поддержке. Не запускайте полученный код без проверки.</p><ul className="space-y-2">{view.attachments.map(file => <li key={file.id} className="text-sm break-words"><a href={`/api/orders/${job.id}/attachments/${file.id}`} className="text-cyan hover:underline">{file.fileName}</a><span className="ml-2 text-muted-foreground">{Math.ceil(file.fileSize / 1024)} КБ</span></li>)}</ul>{!view.attachments.length && <p className="text-sm text-muted-foreground">Файлов пока нет.</p>}
      {member && ["IN_PROGRESS", "ACCEPTANCE"].includes(job.status) && job.publicationStatus === "APPROVED" && (storageAvailable ? <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
        event.preventDefault(); const form = event.currentTarget, file = new FormData(form).get("file")
        if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024) { setError("Выберите непустой файл до 10 МБ"); return }
        void perform(async () => {
          const input = form.querySelector<HTMLInputElement>('input[type="file"]')?.files?.[0] ?? file
          const id = uploadIds.current.get(input) ?? crypto.randomUUID(); uploadIds.current.set(input, id)
          const response = await fetch(`/api/orders/${job.id}/attachments`, { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Upload-ID": id, "X-File-Name": encodeURIComponent(input.name) }, body: input })
          const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error ?? "Не удалось загрузить файл")
          form.reset(); await reload()
        })
      }}><div className="min-w-0 flex-1"><label htmlFor="job-attachment" className="block text-sm mb-2">Добавить файл до 10 МБ</label><input id="job-attachment" name="file" type="file" className={`${jobInputClass} max-w-full`} disabled={busy} required /></div><Button type="submit" variant="outline" disabled={busy}>Загрузить файл</Button></form> : <p className="text-sm text-muted-foreground">Обмен файлами сейчас недоступен. Описание результата можно сохранить в рабочей области.</p>)}
    </section>

    <section className="space-y-4"><h2 className="text-xl font-semibold">Сдача и приёмка</h2>
      {developer && working && job.status === "IN_PROGRESS" && <form className="rounded-xl border border-violet/30 bg-violet/5 p-5 space-y-3" onSubmit={event => {
        event.preventDefault(); const form = event.currentTarget, values = new FormData(form), text = String(values.get("text")), attachmentIds = values.getAll("attachment").map(String), signature = JSON.stringify([text.trim(), attachmentIds])
        if (deliveryNonce.current?.signature !== signature) deliveryNonce.current = { id: crypto.randomUUID(), signature }
        const id = deliveryNonce.current.id
        void perform(async () => { await jobFetch(`/api/orders/${job.id}`, { action: "DELIVER", id, text, attachmentIds }); deliveryNonce.current = null; await reload() })
      }}><label htmlFor="delivery-text" className="block text-sm">Что сделано и как проверить результат</label><textarea id="delivery-text" name="text" className={jobInputClass} rows={5} minLength={30} maxLength={8000} required disabled={busy} />{view.attachments.filter(file => file.authorId === actorId).map(file => <label key={file.id} className="flex gap-2 text-sm break-all"><input type="checkbox" name="attachment" value={file.id} />{file.fileName}</label>)}<Button disabled={busy} type="submit">Сдать результат на приёмку</Button></form>}
      {customer && working && pending && job.status === "ACCEPTANCE" && <div className="rounded-xl border border-cyan/30 bg-cyan/5 p-5 space-y-3"><p className="text-sm">Проверьте результат по согласованным критериям. После приёмки откроются отзывы.</p><Button disabled={busy} onClick={() => command({ action: "ACCEPT", deliveryId: pending.id })}>Принять результат и завершить заказ</Button></div>}
      {!view.deliveries.length && <p className="text-sm text-muted-foreground">Результат ещё не сдавался.</p>}
      {view.deliveries.map(delivery => <article key={delivery.id} className="rounded-xl border border-border p-5 space-y-3"><p className="text-xs text-muted-foreground">{dateText(delivery.createdAt)} · {({ PENDING: "Ожидает приёмки", ACCEPTED: "Принят заказчиком", CHANGES_REQUESTED: "Запрошена доработка" })[delivery.status]}</p><p className="whitespace-pre-wrap break-words text-sm">{delivery.text}</p><ul className="space-y-1">{delivery.attachmentIds.map(id => <li key={id}><a className="text-sm text-cyan hover:underline" href={`/api/orders/${job.id}/attachments/${id}`}>{view.attachments.find(file => file.id === id)?.fileName ?? "Файл результата"}</a></li>)}</ul>{delivery.customerFeedback && <p className="text-sm whitespace-pre-wrap break-words">Доработка: {delivery.customerFeedback}</p>}</article>)}
    </section>

    {member && active && <section className="rounded-xl border border-border p-5 space-y-3"><label htmlFor="job-reason" className="block text-sm">Комментарий для доработки, отмены или поддержки</label><textarea id="job-reason" className={jobInputClass} value={reason} onChange={event => setReason(event.target.value)} rows={3} maxLength={2000} /><div className="flex flex-wrap gap-3">{customer && working && pending && job.status === "ACCEPTANCE" && <Button variant="outline" disabled={busy || reason.trim().length < 10} onClick={() => command({ action: "REVISION", deliveryId: pending.id, reason })}>Вернуть на доработку</Button>}{!job.cancellationRequestedBy && <Button variant="outline" disabled={busy || reason.trim().length < 10} onClick={() => command({ action: "CANCEL", reason })}>Предложить отмену</Button>}<Button variant="outline" disabled={busy || reason.trim().length < 10} onClick={() => command({ action: "DISPUTE", reason })}>Открыть спор и обратиться в поддержку</Button></div></section>}

    <section className="rounded-xl border border-border bg-card p-5 space-y-4"><h2 className="text-xl font-semibold">Переписка</h2>
      {view.hasOlderMessages && <Button variant="outline" disabled={busy} onClick={() => perform(async () => { const response = await fetch(`/api/orders/${job.id}/workspace?before=${view.messages[0].id}`, { cache: "no-store" }), older = await response.json(); if (!response.ok) throw new Error(older.error); setView(previous => ({ ...previous, messages: [...older.messages, ...previous.messages], hasOlderMessages: older.hasOlderMessages })) })}>Загрузить предыдущие сообщения</Button>}
      {!view.messages.length && <p className="text-sm text-muted-foreground">Обсудите детали и ход работы здесь.</p>}
      <ul className="space-y-3">{view.messages.map(message => <li key={message.id} className={`rounded-lg border border-border p-3 ${message.senderId === actorId ? "bg-cyan/5" : "bg-background"}`}><p className="text-xs text-muted-foreground">{message.sender.name ?? (message.senderId === contract.developerId ? "Исполнитель" : message.senderId === job.customerId ? "Заказчик" : "Поддержка")} · {dateText(message.createdAt)}</p><p className="mt-2 text-sm whitespace-pre-wrap break-words">{message.text}</p></li>)}</ul>
      {!["COMPLETED", "CANCELLED"].includes(job.status) && <form className="space-y-3" onSubmit={event => {
        event.preventDefault(); const form = event.currentTarget, text = String(new FormData(form).get("text")).trim()
        if (messageNonce.current?.text !== text) messageNonce.current = { id: crypto.randomUUID(), text }
        const id = messageNonce.current.id
        void perform(async () => { await jobFetch(`/api/orders/${job.id}`, { action: "MESSAGE", id, text }); messageNonce.current = null; form.reset(); await reload() })
      }}><label htmlFor="job-message" className="block text-sm">Сообщение</label><textarea id="job-message" name="text" className={jobInputClass} rows={3} minLength={1} maxLength={4000} required disabled={busy} /><Button disabled={busy} type="submit">Отправить сообщение</Button></form>}
    </section>

    {job.status === "COMPLETED" && <section className="space-y-4"><h2 className="text-xl font-semibold">Отзывы участников</h2>{view.reviews.map(review => <article key={review.id} className="rounded-xl border border-border p-4"><p className="text-sm font-semibold">{review.authorId === job.customerId ? "От заказчика" : "От исполнителя"} · {review.rating}/5</p><p className="mt-2 text-sm whitespace-pre-wrap break-words">{review.text}</p></article>)}{member && !view.reviews.some(review => review.authorId === actorId) && <form className="space-y-3" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void command({ action: "REVIEW", rating: Number(form.get("rating")), text: form.get("text") }) }}><label className="block text-sm" htmlFor="job-rating">Оценка другой стороне</label><select className={jobInputClass} id="job-rating" name="rating">{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} из 5</option>)}</select><label htmlFor="job-review" className="block text-sm">Публичный отзыв без контактов и приватных деталей</label><textarea id="job-review" name="text" className={jobInputClass} rows={4} minLength={20} maxLength={2000} required /><Button type="submit" disabled={busy}>Опубликовать отзыв</Button></form>}</section>}
    <details className="rounded-xl border border-border p-5"><summary className="cursor-pointer text-sm">Последние события заказа</summary><ul className="mt-4 space-y-3 text-xs text-muted-foreground">{view.events.map(event => <li key={event.id}>{dateText(event.createdAt)} · {event.toStatus ? JOB_STATUS_LABELS[event.toStatus as keyof typeof JOB_STATUS_LABELS] ?? "Состояние обновлено" : "Состояние обновлено"}{event.reason && <p className="mt-1 whitespace-pre-wrap break-words">{event.reason}</p>}</li>)}</ul></details>
  </div>
}
