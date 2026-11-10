import Link from "next/link"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/current-user"
import { isStaff } from "@/lib/permissions"
import { PUBLICATION_LABELS, JOB_STATUS_LABELS } from "@/lib/jobs/policy"

export const metadata = { title: "Модерация заказов", robots: { index: false, follow: false } }
export default async function AdminOrdersPage() {
  const actor = await getCurrentUser(); if (!actor) redirect("/login?callbackUrl=/admin/orders"); if (!isStaff(actor.role)) redirect("/dashboard")
  const [pending, disputes, recent] = await Promise.all([
    db.job.findMany({ where: { publicationStatus: "PENDING", status: "OPEN" }, orderBy: { updatedAt: "asc" }, take: 100, select: { id: true, title: true } }),
    db.job.findMany({ where: { status: "DISPUTED" }, orderBy: { updatedAt: "asc" }, take: 100, select: { id: true, title: true } }),
    db.job.findMany({ orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, title: true, publicationStatus: true, status: true } }),
  ])
  return <div className="mx-auto max-w-4xl px-4 py-8 space-y-8"><Link className="text-sm text-cyan hover:underline" href="/admin">← Рабочий стол</Link><h1 className="text-3xl font-semibold">Модерация заказов</h1><section className="space-y-3"><h2 className="text-xl font-semibold">Ожидают проверки</h2><p className="text-sm text-muted-foreground">Проверьте публичное описание на контакты и приватные данные, результат, бюджет и срок.</p>{!pending.length && <p className="text-sm text-muted-foreground">Очередь пуста.</p>}<ul className="space-y-3">{pending.map(job => <li key={job.id}><Link href={`/orders/${job.id}`} className="text-cyan hover:underline">{job.title}</Link></li>)}</ul></section><section className="space-y-3"><h2 className="text-xl font-semibold">Открытые споры</h2>{!disputes.length && <p className="text-sm text-muted-foreground">Открытых споров нет.</p>}<ul className="space-y-3">{disputes.map(job => <li key={job.id}><Link href={`/orders/${job.id}/workspace`} className="text-cyan hover:underline">{job.title}</Link></li>)}</ul></section><section className="space-y-3"><h2 className="text-xl font-semibold">Последние 100 заказов</h2><ul className="space-y-3">{recent.map(job => <li key={job.id} className="rounded-xl border border-border p-4"><Link href={`/orders/${job.id}`} className="font-semibold hover:text-cyan">{job.title}</Link><p className="mt-2 text-xs text-muted-foreground">{PUBLICATION_LABELS[job.publicationStatus]} · {JOB_STATUS_LABELS[job.status]}</p></li>)}</ul></section></div>
}
