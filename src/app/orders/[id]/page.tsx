import Link from "next/link"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/current-user"
import { isStaff, canManageCode } from "@/lib/permissions"
import { readJob, readProposals } from "@/lib/jobs/read"
import { publicJobsWhere } from "@/lib/jobs/query"
import { JobError, JOB_STATUS_LABELS, PUBLICATION_LABELS, SPECIALIZATIONS } from "@/lib/jobs/policy"
import { JobManagement } from "@/components/jobs/JobManagement"
import { Proposals } from "@/components/jobs/Proposals"
import { BecomeDeveloperButton } from "@/app/sell/BecomeDeveloperButton"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/utils"

type Params = { params: Promise<{ id: string }> }
export async function generateMetadata({ params }: Params) {
  try {
    const job = await db.job.findFirst({ where: { id: (await params).id, ...publicJobsWhere }, select: { title: true, outcome: true } })
    if (job) return { title: job.title, description: job.outcome.slice(0, 160) }
  } catch {}
  return { title: "Заказ", robots: { index: false, follow: false } }
}
export default async function OrderPage({ params }: Params) {
  const { id } = await params, actor = await getCurrentUser()
  let result: Awaited<ReturnType<typeof readJob>>, proposals: Awaited<ReturnType<typeof readProposals>> | null = null, workspace = false
  try {
    result = await readJob(id, actor)
    if (actor) {
      proposals = await readProposals(id, actor)
      const contract = await db.jobContract.findUnique({ where: { jobId: id }, select: { customerId: true, developerId: true } })
      workspace = !!contract && ([contract.customerId, contract.developerId].includes(actor.id) || isStaff(actor.role))
    }
  } catch (error) {
    if (error instanceof JobError && error.status === 404) notFound()
    return <div role="status" className="mx-auto max-w-3xl px-4 py-12">Не удалось загрузить заказ. Попробуйте позже.</div>
  }
  const job = result.job!; if (!job) notFound()
  const owner = job.customer.id === actor?.id, staff = isStaff(actor?.role), publication = result.canManage ? job.publicationStatus : "APPROVED"
  const open = job.status === "OPEN" && publication === "APPROVED" && new Date(job.deadline) > new Date()
  return <div className="mx-auto max-w-4xl px-4 py-8 space-y-7"><Link href="/orders" className="text-sm text-cyan hover:underline">← Все заказы</Link><div className="space-y-3"><p className="text-xs text-muted-foreground">{SPECIALIZATIONS[job.specialization as keyof typeof SPECIALIZATIONS]} · {JOB_STATUS_LABELS[job.status]}{result.canManage && publication ? ` · ${PUBLICATION_LABELS[publication]}` : ""}</p><h1 className="text-3xl font-semibold break-words">{job.title}</h1><p className="text-sm text-muted-foreground">Заказчик: {job.customer.name ?? "Пользователь"}</p><div className="flex flex-wrap gap-5"><p className="font-semibold text-cyan">{formatPrice(job.budgetMin)} — {formatPrice(job.budgetMax)}</p><p className="text-sm text-muted-foreground">Желаемый срок: {new Date(job.deadline).toLocaleDateString("ru-RU")}</p></div></div>
    <section className="rounded-xl border border-border bg-card p-5 space-y-3"><h2 className="text-lg font-semibold">Задача</h2><p className="text-sm whitespace-pre-wrap break-words">{job.description}</p></section><section className="space-y-3"><h2 className="text-lg font-semibold">Ожидаемый результат</h2><p className="text-sm whitespace-pre-wrap break-words">{job.outcome}</p></section>
    {workspace && <Button asChild><Link href={`/orders/${id}/workspace`}>Открыть рабочую область</Link></Button>}
    {job.status === "OPEN" && !open && publication === "APPROVED" && <p className="text-sm text-muted-foreground">Желаемый срок истёк. Приём новых откликов завершён.</p>}
    {result.canManage && job.moderationReason && <p className="rounded-xl border border-border p-4 text-sm whitespace-pre-wrap break-words">Комментарий модератора: {job.moderationReason}</p>}
    {result.canManage && <JobManagement id={id} revision={job.revision ?? 0} publicationStatus={publication!} status={job.status} owner={owner} staff={staff} />}
    {actor && proposals ? <Proposals jobId={id} actorId={actor.id} customer={owner} manager={staff} canPropose={!owner && canManageCode(actor.role)} open={open} {...proposals} /> : <p className="text-sm text-muted-foreground"><Link href={`/login?callbackUrl=${encodeURIComponent(`/orders/${id}`)}`} className="text-cyan hover:underline">Войдите</Link>, чтобы откликнуться или работать с заказом.</p>}
    {actor?.role === "BUYER" && !owner && open && <div className="rounded-xl border border-violet/30 p-5 space-y-3"><p className="text-sm">Для бесплатного отклика включите режим разработчика в этом аккаунте.</p><BecomeDeveloperButton /></div>}
  </div>
}
