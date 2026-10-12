import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"
import { COMPLAINT_STATUS_LABELS } from "@/lib/complaint-status"

export const metadata = { title: "Жалобы правообладателей" }

export default async function AdminComplaintsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) redirect("/")

  const complaints = await db.rightsComplaint.findMany({ orderBy: { createdAt: "desc" }, take: 200 })

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Рабочий стол
      </Link>
      <h1 className="text-2xl font-semibold">Жалобы правообладателей</h1>

      {complaints.length === 0 ? (
        <p className="text-sm text-muted-foreground">Жалоб нет.</p>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border">
          {complaints.map((c) => (
            <Link key={c.id} href={`/admin/rights-complaints/${c.id}`} className="block px-4 py-3 hover:bg-muted/20">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.claimant}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.productUrl || "товар не указан"} · {new Date(c.createdAt).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {COMPLAINT_STATUS_LABELS[c.status] ?? c.status}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
