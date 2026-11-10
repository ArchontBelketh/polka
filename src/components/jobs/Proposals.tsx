"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/utils"
import { priceInKopecks } from "@/lib/catalog-query"
import { jobFetch, jobInputClass } from "./client"

type Proposal = { id: string; developerId: string; amount: number; durationDays: number; approach: string; status: string; revision: number; developer: { id: string; name: string | null } }
export function Proposals({ jobId, proposals, actorId, customer, manager = false, canPropose, open, history }: { jobId: string; proposals: Proposal[]; actorId: string; customer: boolean; manager?: boolean; canPropose: boolean; open: boolean; history: { proposalId: string | null; action: string; data: unknown; createdAt: Date | string }[] }) {
  const router = useRouter(), guard = useRef(false), own = proposals.find(proposal => proposal.developerId === actorId)
  const [busy, setBusy] = useState(false), [error, setError] = useState("")
  async function send(url: string, body: unknown) {
    if (guard.current) return; guard.current = true; setBusy(true); setError("")
    try { await jobFetch(url, body); router.refresh() } catch (problem) { setError(problem instanceof Error ? problem.message : "Не удалось сохранить отклик") }
    finally { guard.current = false; setBusy(false) }
  }
  return <section className="space-y-5"><h2 className="text-xl font-semibold">{customer || manager ? "Отклики исполнителей" : "Ваш отклик"}</h2>
    {proposals.length === 0 && <p className="text-sm text-muted-foreground">Откликов пока нет.</p>}
    {proposals.map(proposal => <article key={`${proposal.id}/${proposal.revision}`} className="rounded-xl border border-border bg-card p-5 space-y-3"><div className="flex flex-wrap justify-between gap-2"><Link href={`/developer/${proposal.developerId}`} className="font-semibold hover:text-cyan">{proposal.developer.name ?? "Разработчик"}</Link><span className="text-sm text-cyan">{formatPrice(proposal.amount)} · {proposal.durationDays} дн.</span></div><p className="whitespace-pre-wrap break-words text-sm">{proposal.approach}</p><p className="text-xs text-muted-foreground">{({ ACTIVE: "Отклик активен", WITHDRAWN: "Отозван исполнителем", SELECTED: "Исполнитель выбран", DECLINED: "Выбран другой исполнитель" } as Record<string, string>)[proposal.status]}</p>
      {customer && open && proposal.status === "ACTIVE" && <Button disabled={busy} onClick={() => send(`/api/orders/${jobId}`, { action: "SELECT", proposalId: proposal.id, proposalRevision: proposal.revision })}>Выбрать исполнителя</Button>}
      {!customer && open && proposal.developerId === actorId && proposal.status === "ACTIVE" && <Button variant="outline" disabled={busy} onClick={() => send(`/api/orders/${jobId}`, { action: "WITHDRAW", revision: proposal.revision })}>Отозвать отклик</Button>}
    </article>)}
    {canPropose && open && <form key={own?.revision ?? 0} className="rounded-xl border border-violet/30 bg-violet/5 p-5 space-y-4" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); const amount = priceInKopecks(String(form.get("amount"))); if (!amount || Number(form.get("days")) < 1) { setError("Укажите цену и срок"); return } void send(`/api/orders/${jobId}/proposals`, { amount, durationDays: Number(form.get("days")), approach: form.get("approach"), revision: own?.revision ?? 0 }) }}><h3 className="font-semibold">{own ? "Обновить предложение" : "Откликнуться бесплатно"}</h3><div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="proposal-price" className="text-sm">Ваша цена, ₽</label><input id="proposal-price" name="amount" className={jobInputClass} inputMode="decimal" defaultValue={own ? own.amount / 100 : ""} required /></div><div><label htmlFor="proposal-days" className="text-sm">Срок после выбора, дней</label><input id="proposal-days" name="days" type="number" min={1} max={365} className={jobInputClass} defaultValue={own?.durationDays ?? 7} required /></div></div><div><label htmlFor="proposal-approach" className="text-sm">Как решите задачу</label><textarea id="proposal-approach" name="approach" className={jobInputClass} rows={4} minLength={30} maxLength={4000} defaultValue={own?.approach} required /></div><p className="text-xs text-muted-foreground">Согласуйте объём и критерии в предложении. Его цену, срок и текст зафиксируем при выборе исполнителя.</p><Button disabled={busy} type="submit">{busy ? "Сохраняем…" : "Сохранить отклик"}</Button></form>}
    {history.length > 0 && <details className="rounded-xl border border-border p-4 text-sm"><summary className="cursor-pointer">История предложений</summary><ul className="mt-3 space-y-2 text-muted-foreground">{history.map((item, index) => <li key={index}>{new Date(item.createdAt).toLocaleString("ru-RU")} · {item.action === "WITHDRAW" ? "Отклик отозван" : "Предложение сохранено"}{item.data && typeof item.data === "object" && "amount" in item.data ? ` · ${formatPrice(Number(item.data.amount))}` : ""}</li>)}</ul></details>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
  </section>
}
