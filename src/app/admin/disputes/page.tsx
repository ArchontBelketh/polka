import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/utils"
import { DisputeResolveActions } from "./DisputeResolveActions"
import { ArrowLeft, MessageSquare } from "lucide-react"

export const metadata = { title: "Споры" }

export default async function AdminDisputesPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) redirect("/")

  const disputes = await db.purchase.findMany({
    where: { status: "DISPUTED" },
    orderBy: { lastMessageAt: "desc" },
    include: {
      product: {
        select: { title: true, slug: true, authorId: true, author: { select: { name: true, email: true } } },
      },
      buyer: { select: { id: true, name: true, email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200,
        select: { id: true, text: true, senderId: true, createdAt: true },
      },
    },
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Рабочий стол
      </Link>

      <h1 className="text-2xl font-semibold">Споры ({disputes.length})</h1>

      {disputes.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">Открытых споров нет.</div>
      ) : (
        <div className="space-y-6">
          {disputes.map((d) => {
            const buyerName = d.buyer.name ?? d.buyer.email ?? "Покупатель"
            const devName = d.product.author.name ?? d.product.author.email ?? "Разработчик"
            return (
              <div key={d.id} className="rounded-lg border border-border bg-card p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/product/${d.product.slug}`} className="font-semibold hover:underline">
                      {d.product.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      Покупатель: {buyerName} · Разработчик: {devName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatPrice(d.amount)} · покупка от {new Date(d.createdAt).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                  <Badge variant="destructive">Спор</Badge>
                </div>

                {/* Conversation */}
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Переписка ({d.messages.length})
                  </p>
                  {d.messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Переписки между сторонами не было.</p>
                  ) : (
                    <div className="max-h-72 space-y-2 overflow-y-auto rounded-md bg-muted/30 p-3">
                      {d.messages.map((m) => {
                        const fromBuyer = m.senderId === d.buyer.id
                        return (
                          <div key={m.id} className="text-sm">
                            <span className={fromBuyer ? "font-medium text-foreground" : "font-medium text-primary"}>
                              {fromBuyer ? buyerName : devName}:
                            </span>{" "}
                            <span className="text-muted-foreground whitespace-pre-wrap">{m.text}</span>
                            <span className="ml-1 text-[10px] text-muted-foreground/60">
                              {new Date(m.createdAt).toLocaleString("ru-RU", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <DisputeResolveActions purchaseId={d.id} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
