import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/current-user"
import { readWorkspace } from "@/lib/jobs/read"
import { JobError } from "@/lib/jobs/policy"
import { jobStorageConfigured } from "@/lib/jobs/files"
import { isStaff } from "@/lib/permissions"
import { JobWorkspace } from "@/components/jobs/JobWorkspace"

export const metadata = { title: "Рабочая область заказа", robots: { index: false, follow: false } }
export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, actor = await getCurrentUser()
  if (!actor) redirect(`/login?callbackUrl=${encodeURIComponent(`/orders/${id}/workspace`)}`)
  try { return <div className="mx-auto max-w-4xl px-4 py-8"><JobWorkspace initial={await readWorkspace(id, actor)} actorId={actor.id} staff={isStaff(actor.role)} storageAvailable={jobStorageConfigured()} /></div> }
  catch (error) { if (error instanceof JobError && error.status === 404) notFound(); return <p role="status" className="mx-auto max-w-4xl px-4 py-12">Рабочая область временно недоступна. Обновите страницу позже.</p> }
}
