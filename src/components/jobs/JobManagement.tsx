"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { jobFetch, jobInputClass } from "./client"

export function JobManagement({ id, revision, publicationStatus, status, owner, staff }: { id: string; revision: number; publicationStatus: string; status: string; owner: boolean; staff: boolean }) {
  const router = useRouter(), guard = useRef(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [reason, setReason] = useState("")
  async function act(action: string) {
    if (guard.current) return; guard.current = true; setBusy(true); setError("")
    try { await jobFetch(`/api/orders/${id}`, { action, ...(["CANCEL"].includes(action) ? { reason: "Заказчик отменил поиск исполнителя" } : { revision, ...(action !== "SUBMIT" ? { reason } : {}) }) }); router.refresh() }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Ошибка действия") }
    finally { guard.current = false; setBusy(false) }
  }
  return <section aria-label="Управление заказом" className="rounded-xl border border-border bg-card p-5 space-y-4">
    {owner && status === "OPEN" && <div className="flex flex-wrap gap-3">{["DRAFT", "REJECTED"].includes(publicationStatus) && <><Button asChild variant="outline"><Link href={`/orders/${id}/edit`}>Редактировать</Link></Button><Button disabled={busy} onClick={() => act("SUBMIT")}>Отправить на модерацию</Button></>}<Button variant="outline" disabled={busy} onClick={() => act("CANCEL")}>Отменить заказ</Button></div>}
    {staff && <div className="space-y-3"><label htmlFor="moderation-reason" className="block text-sm">Комментарий модератора</label><textarea id="moderation-reason" className={jobInputClass} rows={3} value={reason} maxLength={2000} onChange={event => setReason(event.target.value)} /><div className="flex flex-wrap gap-3">{publicationStatus === "PENDING" && <><Button disabled={busy || reason.trim().length < 10} onClick={() => act("APPROVE")}>Опубликовать</Button><Button variant="outline" disabled={busy || reason.trim().length < 10} onClick={() => act("REJECT")}>Вернуть на доработку</Button></>}{publicationStatus === "APPROVED" && <Button variant="destructive" disabled={busy || reason.trim().length < 10} onClick={() => act("SUSPEND")}>Скрыть заказ</Button>}{publicationStatus === "SUSPENDED" && <Button disabled={busy || reason.trim().length < 10} onClick={() => act("RESTORE")}>Восстановить публикацию</Button>}</div></div>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
  </section>
}
