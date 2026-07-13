import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { MessageThread, type ThreadMessage } from "@/components/messages/MessageThread"
import { formatPrice } from "@/lib/utils"
import { ArrowLeft } from "lucide-react"

type RouteParams = { params: Promise<{ id: string }> }

const STATUS_LABELS: Record<string, string> = {
  PAID: "Оплачено",
  DELIVERED: "Оплачено",
  REFUNDED: "Отменено",
}

export const metadata = { title: "Диалог" }

export default async function DeveloperThreadPage({ params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const { id } = await params
  const purchase = await db.purchase.findUnique({
    where: { id },
    include: {
      product: { select: { title: true, slug: true, authorId: true } },
      buyer: { select: { name: true, email: true } },
    },
  })

  // Only the product's author may open this developer-side thread
  if (!purchase || purchase.product.authorId !== userId) notFound()

  const THREAD_STATUSES = ["PAID", "DELIVERED"]
  if (!THREAD_STATUSES.includes(purchase.status)) notFound()

  const canWrite = ["PAID", "DELIVERED"].includes(purchase.status)
  const buyerName = purchase.buyer.name ?? purchase.buyer.email ?? "Покупатель"

  // Mark buyer's messages as read, then load the thread
  await db.purchaseMessage.updateMany({
    where: { purchaseId: id, senderId: { not: userId }, isRead: false },
    data: { isRead: true },
  })
  const rows = await db.purchaseMessage.findMany({
    where: { purchaseId: id },
    orderBy: { createdAt: "asc" },
    take: 500,
    select: { id: true, text: true, senderId: true, createdAt: true },
  })
  const initialMessages: ThreadMessage[] = rows.map((r) => ({
    id: r.id,
    text: r.text,
    senderId: r.senderId,
    createdAt: r.createdAt.toISOString(),
  }))

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <Link
        href="/dashboard/messages"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Ко всем диалогам
      </Link>

      <div className="rounded-lg border border-border bg-card p-4 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/product/${purchase.product.slug}`} className="font-semibold hover:underline">
            {purchase.product.title}
          </Link>
          <Badge variant="outline" className="text-xs">
            {STATUS_LABELS[purchase.status] ?? purchase.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Покупатель: {buyerName} · {formatPrice(purchase.amount)}
        </p>
      </div>

      <MessageThread
        purchaseId={purchase.id}
        currentUserId={userId}
        initialMessages={initialMessages}
        canWrite={canWrite}
      />
    </div>
  )
}
