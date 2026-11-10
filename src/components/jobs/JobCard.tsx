import Link from "next/link"
import { formatPrice } from "@/lib/utils"
import { SPECIALIZATIONS, JOB_STATUS_LABELS } from "@/lib/jobs/policy"

export function JobCard({ job }: { job: { id: string; title: string; outcome: string; specialization: string; budgetMin: number; budgetMax: number; deadline: Date | string; status: string } }) {
  return <article className="rounded-2xl border border-border bg-card p-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{SPECIALIZATIONS[job.specialization as keyof typeof SPECIALIZATIONS]}</span><span>{job.status === "OPEN" && new Date(job.deadline) <= new Date() ? "Приём откликов завершён" : JOB_STATUS_LABELS[job.status as keyof typeof JOB_STATUS_LABELS]}</span></div>
    <h2 className="text-lg font-semibold break-words"><Link href={`/orders/${job.id}`} className="hover:text-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan">{job.title}</Link></h2>
    <p className="line-clamp-3 break-words whitespace-pre-wrap text-sm text-muted-foreground">{job.outcome}</p>
    <div className="flex flex-wrap justify-between gap-3 text-sm"><span className="font-semibold text-cyan">{formatPrice(job.budgetMin)} — {formatPrice(job.budgetMax)}</span><span className="text-muted-foreground">Срок: {new Date(job.deadline).toLocaleDateString("ru-RU")}</span></div>
  </article>
}
