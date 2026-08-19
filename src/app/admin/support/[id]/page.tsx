import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ReplyForm } from "@/components/support/ReplyForm"
import { TicketStatusControl } from "@/components/support/TicketStatusControl"
import { RefundButton } from "./RefundButton"
import { formatPrice } from "@/lib/utils"
import { saleModelForKopecks } from "@/lib/tariffs"

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
const ROLE_LABELS: Record<string, string> = {
  BUYER: "Покупатель",
  DEVELOPER: "Разработчик",
  MODERATOR: "Модератор",
  ADMIN: "Администратор",
}

export default async function AdminSupportThreadPage({ params }: RouteParams) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) redirect("/")

  const { id } = await params

  const ticket = await db.supportTicket.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, email: true, role: true } },
      product: { select: { id: true, title: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, email: true, role: true } } },
      },
    },
  })

  if (!ticket) notFound()

  // Для претензии — подгружаем покупку, чтобы предложить операторский возврат
  let claimPurchase: {
    id: string; amount: number; status: string
    product: { title: string; price: number; saleModel: string | null }
  } | null = null
  if (ticket.category === "CLAIM" && ticket.purchaseId) {
    claimPurchase = await db.purchase.findUnique({
      where: { id: ticket.purchaseId },
      select: {
        id: true, amount: true, status: true,
        product: { select: { title: true, price: true, saleModel: true } },
      },
    })
  }
  const claimModel = claimPurchase
    ? (claimPurchase.product.saleModel ?? saleModelForKopecks(claimPurchase.product.price))
    : null
  const canRefund =
    !!claimPurchase && claimModel === "COMMISSION" &&
    (claimPurchase.status === "PAID" || claimPurchase.status === "DELIVERED")

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/admin/support" className="hover:underline">← Обращения</Link>
        </p>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold">{ticket.subject}</h1>
          <Badge variant={STATUS_VARIANTS[ticket.status] ?? "outline"} className="shrink-0 mt-0.5">
            {STATUS_LABELS[ticket.status] ?? ticket.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {CATEGORY_LABELS[ticket.category] ?? ticket.category}
          {" · "}
          <Link href={`/admin/user/${ticket.author.id}`} className="hover:underline">
            {ticket.author.name ?? ticket.author.email}
          </Link>
          {" "}({ROLE_LABELS[ticket.author.role] ?? ticket.author.role})
          {ticket.product && (
            <> · <Link href={`/admin/review/${ticket.product.id}`} className="hover:underline">{ticket.product.title}</Link></>
          )}
        </p>
      </div>

      {/* Status control */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <span className="text-sm text-muted-foreground">Изменить статус:</span>
        <TicketStatusControl ticketId={ticket.id} status={ticket.status} />
      </div>

      {/* Претензия — операторский возврат */}
      {claimPurchase && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
          <p className="text-sm font-medium">Претензия по покупке</p>
          <p className="text-xs text-muted-foreground">
            {claimPurchase.product.title} · {formatPrice(claimPurchase.amount)}
          </p>
          {claimPurchase.status === "REFUNDED" ? (
            <p className="text-sm text-green-500">Возврат оформлен.</p>
          ) : canRefund ? (
            <RefundButton purchaseId={claimPurchase.id} />
          ) : (
            <p className="text-xs text-muted-foreground">
              Возврат через площадку недоступен (модель не «Комиссия» или неподходящий статус покупки).
            </p>
          )}
        </div>
      )}

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
                {msg.isStaff
                  ? `Поддержка (${msg.author.name ?? msg.author.email})`
                  : (msg.author.name ?? msg.author.email)}
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
        <h2 className="text-sm font-medium mb-3">Ответить пользователю</h2>
        <ReplyForm ticketId={ticket.id} closed={ticket.status === "CLOSED"} />
      </div>
    </div>
  )
}
