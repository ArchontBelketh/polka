import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, ArrowLeft } from "lucide-react"

export const metadata = { title: "Сообщения" }

export default async function DashboardMessagesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) redirect("/login")
  if (user.role === "MODERATOR") redirect("/admin")
  if (!["DEVELOPER", "ADMIN"].includes(user.role)) redirect("/purchases")

  const purchases = await db.purchase.findMany({
    where: { product: { authorId: userId }, lastMessageAt: { not: null } },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      product: { select: { title: true } },
      buyer: { select: { name: true, email: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { text: true, senderId: true },
      },
      _count: {
        select: { messages: { where: { senderId: { not: userId }, isRead: false } } },
      },
    },
  })

  // Unread dialogs first, then by recency (already ordered by lastMessageAt)
  const dialogs = [...purchases].sort((a, b) => b._count.messages - a._count.messages)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        В кабинет
      </Link>

      <h1 className="text-2xl font-semibold">Сообщения покупателей</h1>

      {dialogs.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground space-y-2">
          <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p>Сообщений пока нет.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border">
          {dialogs.map((p) => {
            const last = p.messages[0]
            const unread = p._count.messages
            const buyerName = p.buyer.name ?? p.buyer.email ?? "Покупатель"
            return (
              <Link
                key={p.id}
                href={`/dashboard/messages/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{p.product.title}</p>
                    {unread > 0 && (
                      <Badge variant="default" className="shrink-0 text-xs">
                        {unread}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {buyerName}
                    {last && (
                      <>
                        {" · "}
                        {last.senderId === userId ? "Вы: " : ""}
                        {last.text}
                      </>
                    )}
                  </p>
                </div>
                {p.lastMessageAt && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(p.lastMessageAt).toLocaleDateString("ru-RU")}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
