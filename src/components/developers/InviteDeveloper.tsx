"use client"
import Link from "next/link"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"

export function InviteDeveloper({ developerId, signedIn }: { developerId: string; signedIn: boolean }) {
  const [jobs, setJobs] = useState<{ id: string; title: string }[] | null>(null), [jobId, setJobId] = useState("")
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [sent, setSent] = useState(false)
  const inFlight = useRef(false)
  async function act(send: boolean) {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError(""); setSent(false)
    try {
      const response = await fetch(`/api/developers/${developerId}/invitations`, send ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId }) } : { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) { setError(data.error || "Не удалось отправить приглашение"); return }
      if (send) setSent(true)
      else { setJobs(data.jobs); setJobId(data.jobs[0]?.id ?? "") }
    } catch { setError("Ошибка сети. Попробуйте ещё раз — повтор не создаст второе приглашение.") }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <section className="space-y-4 rounded-2xl border border-cyan/25 bg-cyan/5 p-5" aria-labelledby="invite-heading"><h2 id="invite-heading" className="text-lg font-semibold">Предложить задачу</h2><p className="text-sm leading-relaxed text-muted-foreground">Пригласите разработчика откликнуться на опубликованный заказ по его направлению. Он сам решит, подавать ли предложение. Приглашение бесплатно и не назначает исполнителя.</p>
    {!signedIn ? <Button asChild><Link href={`/login?callbackUrl=${encodeURIComponent(`/developer/${developerId}`)}`}>Войти и пригласить</Link></Button> : jobs === null ? <Button disabled={busy} onClick={() => act(false)}>{busy ? "Загрузка…" : "Выбрать свой заказ"}</Button> : !jobs.length ? <p className="text-sm text-muted-foreground">Нет подходящих опубликованных заказов с открытыми откликами. <Link href="/orders/new" className="text-cyan hover:underline">Создать заказ</Link></p> : <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); void act(true) }}><div className="min-w-0 flex-1 basis-64 space-y-2"><label htmlFor="invite-job" className="text-sm">Ваш заказ</label><select id="invite-job" value={jobId} disabled={busy} onChange={event => { setJobId(event.target.value); setSent(false) }} className="w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm">{jobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}</select></div><Button disabled={busy || sent} type="submit">{busy ? "Отправка…" : sent ? "Приглашение отправлено" : "Пригласить откликнуться"}</Button></form>}
    {sent && <p role="status" className="text-sm text-green-400">Приглашение сохранено в кабинете разработчика.</p>}{error && <p role="alert" className="text-sm text-red-400">{error}</p>}
  </section>
}
