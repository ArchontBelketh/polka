import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/current-user"
import { db } from "@/lib/db"
import { JobForm } from "@/components/jobs/JobForm"

export const metadata = { title: "Изменить черновик заказа", robots: { index: false, follow: false } }
export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, actor = await getCurrentUser()
  if (!actor) redirect(`/login?callbackUrl=${encodeURIComponent(`/orders/${id}/edit`)}`)
  const job = await db.job.findFirst({ where: { id, customerId: actor.id, status: "OPEN", publicationStatus: { in: ["DRAFT", "REJECTED"] } }, select: { id: true, title: true, description: true, outcome: true, specialization: true, budgetMin: true, budgetMax: true, deadline: true, revision: true } })
  if (!job) notFound()
  return <div className="mx-auto max-w-3xl px-4 py-8 space-y-6"><h1 className="text-3xl font-semibold">Изменить заказ</h1><JobForm initial={job} /></div>
}
