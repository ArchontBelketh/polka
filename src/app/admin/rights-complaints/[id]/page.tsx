import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"
import { COMPLAINT_STATUS_LABELS } from "@/lib/complaint-status"
import { ComplaintActions } from "./ComplaintActions"

export const metadata = { title: "Жалоба" }

type RouteParams = { params: Promise<{ id: string }> }

export default async function AdminComplaintPage({ params }: RouteParams) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) redirect("/")

  const { id } = await params
  const complaint = await db.rightsComplaint.findUnique({
    where: { id },
    include: { product: { select: { slug: true, title: true, status: true } } },
  })
  if (!complaint) notFound()

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <Link href="/admin/rights-complaints" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        К жалобам
      </Link>

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">Жалоба правообладателя</h1>
        <Badge variant="outline">{COMPLAINT_STATUS_LABELS[complaint.status] ?? complaint.status}</Badge>
      </div>

      <section className="rounded-lg border border-border bg-card p-5 space-y-3 text-sm">
        <div><p className="text-xs text-muted-foreground">Заявитель</p><p>{complaint.claimant}</p></div>
        <div><p className="text-xs text-muted-foreground">Контакт</p><p className="break-all">{complaint.contact}</p></div>
        <div>
          <p className="text-xs text-muted-foreground">Товар</p>
          {complaint.product ? (
            <Link href={`/product/${complaint.product.slug}`} className="text-primary hover:underline">
              {complaint.product.title} ({complaint.product.status})
            </Link>
          ) : (
            <p className="break-all">{complaint.productUrl || "не указан / не найден"}</p>
          )}
        </div>
        <div><p className="text-xs text-muted-foreground">Охраняемый объект</p><p className="whitespace-pre-wrap">{complaint.protectedObj}</p></div>
        <div><p className="text-xs text-muted-foreground">Подтверждение прав</p><p className="whitespace-pre-wrap">{complaint.rightsProof}</p></div>
        <div><p className="text-xs text-muted-foreground">Описание нарушения</p><p className="whitespace-pre-wrap">{complaint.description}</p></div>
        <p className="text-xs text-muted-foreground">
          Создана {new Date(complaint.createdAt).toLocaleString("ru-RU")} · согласие ПДн {complaint.consentPd ? "✓" : "—"}
        </p>
      </section>

      <ComplaintActions
        complaintId={complaint.id}
        status={complaint.status}
        decision={complaint.decision ?? ""}
        hasProduct={!!complaint.productId}
      />
    </div>
  )
}
