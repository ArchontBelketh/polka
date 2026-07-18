import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Markdown } from "@/components/ui/Markdown"
import { MessageThread, type ThreadMessage } from "@/components/messages/MessageThread"
import { FileClaimButton } from "./FileClaimButton"
import { formatPrice, formatFileSize } from "@/lib/utils"
import { CATEGORY_LABELS } from "@/types"
import { Download, Monitor, FileText, ArrowLeft, MessageSquare } from "lucide-react"

type RouteParams = { params: Promise<{ id: string }> }

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Ожидает оплаты",
  PAID: "Оплачено",
  DELIVERED: "Оплачено",
  REFUNDED: "Отменено",
}
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  PAID: "default",
  DELIVERED: "default",
  REFUNDED: "destructive",
}

export const metadata = { title: "Покупка" }

// Вынесено из компонента: чтение текущего времени нельзя делать в теле рендера
// (react-hooks/purity). Здесь, в обычной функции, это допустимо.
function isWithinClaimWindow(start: Date, days: number): boolean {
  return Date.now() <= start.getTime() + days * 24 * 60 * 60 * 1000
}

export default async function PurchaseDetailPage({ params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params

  const purchase = await db.purchase.findUnique({
    where: { id },
    include: {
      product: {
        include: {
          author: { select: { name: true, email: true } },
          files: {
            where: { fileType: "SOURCE" },
            select: { fileName: true, fileSize: true, format: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  })

  if (!purchase) notFound()

  // Access: the buyer, or staff
  const user = await db.user.findUnique({ where: { id: session.user.id } })
  const isStaff = user?.role === "ADMIN" || user?.role === "MODERATOR"
  if (purchase.buyerId !== session.user.id && !isStaff) notFound()

  const { product } = purchase
  const canDownload = purchase.status === "PAID" || purchase.status === "DELIVERED"
  const authorName = product.author.name ?? product.author.email ?? "Разработчик"

  // Messaging — only for the buyer; load thread and mark incoming as read
  const isBuyer = purchase.buyerId === session.user.id
  const THREAD_STATUSES = ["PAID", "DELIVERED"]
  const showThread = isBuyer && THREAD_STATUSES.includes(purchase.status)
  const canWrite = ["PAID", "DELIVERED"].includes(purchase.status)

  // Претензия (оферта п. 10): окно 7 дней с покупки, одна на покупку
  const CLAIM_WINDOW_DAYS = parseInt(process.env.CLAIM_WINDOW_DAYS ?? "7", 10)
  const claimStart = purchase.paidAt ?? purchase.createdAt
  const withinClaimWindow =
    isBuyer &&
    (purchase.status === "PAID" || purchase.status === "DELIVERED") &&
    isWithinClaimWindow(claimStart, CLAIM_WINDOW_DAYS)
  const existingClaim = isBuyer
    ? await db.supportTicket.findFirst({
        where: { purchaseId: purchase.id, category: "CLAIM" },
        select: { id: true },
      })
    : null

  let initialMessages: ThreadMessage[] = []
  if (showThread) {
    await db.purchaseMessage.updateMany({
      where: { purchaseId: purchase.id, senderId: { not: session.user.id }, isRead: false },
      data: { isRead: true },
    })
    const rows = await db.purchaseMessage.findMany({
      where: { purchaseId: purchase.id },
      orderBy: { createdAt: "asc" },
      take: 500,
      select: { id: true, text: true, senderId: true, createdAt: true },
    })
    initialMessages = rows.map((r) => ({
      id: r.id,
      text: r.text,
      senderId: r.senderId,
      createdAt: r.createdAt.toISOString(),
    }))
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <Link
        href="/purchases"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        К покупкам
      </Link>

      {/* Product header */}
      <div className="rounded-lg border border-border bg-card p-5 flex items-start gap-4">
        {product.screenshots[0] && (
          <Link href={`/product/${product.slug}`} className="shrink-0 hidden sm:block">
            <img src={product.screenshots[0]} alt="" className="h-16 w-24 rounded object-cover" />
          </Link>
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/product/${product.slug}`} className="font-semibold hover:underline">
              {product.title}
            </Link>
            <Badge variant={STATUS_VARIANTS[purchase.status] ?? "outline"} className="text-xs">
              {STATUS_LABELS[purchase.status] ?? purchase.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {CATEGORY_LABELS[product.category as keyof typeof CATEGORY_LABELS]} ·{" "}
            {formatPrice(purchase.amount)} · {new Date(purchase.createdAt).toLocaleDateString("ru-RU")}
          </p>
          <p className="text-xs text-muted-foreground">Автор: {authorName}</p>
        </div>
        {canDownload && (
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href={`/purchases/${purchase.id}/download`}>
              <Download className="h-4 w-4 mr-1" />
              Скачать
            </Link>
          </Button>
        )}
      </div>

      {/* Messaging with the developer */}
      {showThread && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Связь с разработчиком
            </h2>
          </div>

          <p className="text-xs text-muted-foreground">
            Не запускается или есть вопрос по настройке? Напишите автору.
            Обмен контактами и оплата мимо платформы запрещены.
          </p>

          <MessageThread
            purchaseId={purchase.id}
            currentUserId={session.user.id}
            initialMessages={initialMessages}
            canWrite={canWrite}
          />

          {/* Претензия по покупке */}
          {existingClaim ? (
            <Link
              href={`/support/${existingClaim.id}`}
              className="inline-block text-xs text-primary underline underline-offset-2 hover:no-underline"
            >
              По этой покупке открыта претензия — перейти →
            </Link>
          ) : (
            withinClaimWindow && <FileClaimButton purchaseId={purchase.id} />
          )}
        </section>
      )}

      {/* What's included */}
      {product.files.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Что входит в покупку
          </h2>
          <ul className="space-y-2">
            {product.files.map((f, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="font-mono truncate">{f.fileName}</span>
                <span className="text-muted-foreground shrink-0 ml-2">
                  {f.format} · {formatFileSize(f.fileSize)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* System requirements */}
      {product.requirements.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Monitor className="h-4 w-4 text-primary" />
            Системные требования
          </h2>
          <ul className="flex flex-wrap gap-2">
            {product.requirements.map((r, i) => (
              <li key={i} className="rounded-md border border-border bg-muted px-3 py-1.5 text-sm">
                {r}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Full install guide */}
      {product.installGuide && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold">Инструкция по установке</h2>
          <Markdown content={product.installGuide} />
        </section>
      )}

      {!product.installGuide && (
        <p className="text-sm text-muted-foreground">
          Разработчик не приложил инструкцию по установке.
        </p>
      )}
    </div>
  )
}
