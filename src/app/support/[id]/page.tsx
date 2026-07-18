import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ReplyForm } from "@/components/support/ReplyForm"

type RouteParams = { params: Promise<{ id: string }> }

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Открыт",
  IN_PROGRESS: "В работе",
  RESOLVED: "Решён",
  CLOSED: "Закрыт",
}
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  OPEN: "default",
  IN_PROGRESS: "secondary",
  RESOLVED: "outline",
  CLOSED: "outline",
}
const CATEGORY_LABELS: Record<string, string> = {
  APPEAL: "Обжалование решения",
  PURCHASE: "Вопрос по покупке",
  BUG: "Ошибка на сайте",
  OTHER: "Общий вопрос",
  CLAIM: "Претензия по покупке",
}

export default async function SupportThreadPage({ params }: RouteParams) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params

  const ticket = await db.supportTicket.findUnique({
    where: { id },
    include: {
      product: { select: { id: true, title: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, email: true } } },
      },
    },
  })

  if (!ticket) notFound()
  if (ticket.authorId !== session.user.id) redirect("/support")

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/support" className="hover:underline">← Мои обращения</Link>
        </p>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold">{ticket.subject}</h1>
          <Badge variant={STATUS_VARIANTS[ticket.status] ?? "outline"} className="shrink-0 mt-0.5">
            {STATUS_LABELS[ticket.status] ?? ticket.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {CATEGORY_LABELS[ticket.category] ?? ticket.category}
          {ticket.product && (
            <> · <Link href={`/dashboard/products/${ticket.product.id}`} className="hover:underline">{ticket.product.title}</Link></>
          )}
        </p>
      </div>

      {/* Messages */}
      <div className="space-y-4">
        {ticket.messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-lg p-4 ${
              msg.isStaff
                ? "border border-primary/20 bg-primary/5 ml-4"
                : "border border-border bg-card mr-4"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm font-medium">
                {msg.isStaff ? "Служба поддержки" : (msg.author.name ?? msg.author.email)}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(msg.createdAt).toLocaleString("ru-RU", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
          </div>
        ))}
      </div>

      {/* Reply */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium mb-3">Ответить</h2>
        <ReplyForm ticketId={ticket.id} closed={ticket.status === "CLOSED"} />
      </div>
    </div>
  )
}
