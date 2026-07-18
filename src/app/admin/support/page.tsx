import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

export const metadata = { title: "Обращения" }

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
  APPEAL: "Обжалование",
  PURCHASE: "Покупка",
  BUG: "Ошибка",
  OTHER: "Вопрос",
  CLAIM: "Претензия",
}

export default async function AdminSupportPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) redirect("/")

  const [open, inProgress, resolved] = await Promise.all([
    db.supportTicket.count({ where: { status: "OPEN" } }),
    db.supportTicket.count({ where: { status: "IN_PROGRESS" } }),
    db.supportTicket.count({ where: { status: { in: ["RESOLVED", "CLOSED"] } } }),
  ])

  const tickets = await db.supportTicket.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      author: { select: { name: true, email: true, role: true } },
      product: { select: { title: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Обращения</h1>
        <div className="flex gap-3 text-sm text-muted-foreground">
          <span>{open} открытых</span>
          <span>{inProgress} в работе</span>
          <span>{resolved} завершённых</span>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">Обращений пока нет.</div>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => {
            const lastMsg = t.messages[0]
            const isUnanswered = lastMsg && !lastMsg.isStaff && t.status !== "CLOSED"
            return (
              <Link
                key={t.id}
                href={`/admin/support/${t.id}`}
                className={`block rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors ${
                  isUnanswered ? "border-primary/40" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isUnanswered && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                      <p className="font-medium truncate">{t.subject}</p>
                      <Badge variant={STATUS_VARIANTS[t.status] ?? "outline"} className="shrink-0">
                        {STATUS_LABELS[t.status] ?? t.status}
                      </Badge>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {CATEGORY_LABELS[t.category] ?? t.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t.author.name ?? t.author.email} · {t.author.role}
                      {t.product && ` · ${t.product.title}`}
                      {" · "}
                      {t._count.messages} {t._count.messages === 1 ? "сообщение" : "сообщений"}
                    </p>
                    {lastMsg && (
                      <p className="text-sm text-muted-foreground mt-1.5 truncate">
                        {lastMsg.isStaff ? "Поддержка: " : `${t.author.name ?? "Пользователь"}: `}
                        {lastMsg.text}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                    {new Date(t.updatedAt).toLocaleDateString("ru-RU")}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
