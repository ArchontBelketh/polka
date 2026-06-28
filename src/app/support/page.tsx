import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

export const metadata = { title: "Мои обращения" }

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
}

export default async function SupportPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const tickets = await db.supportTicket.findMany({
    where: { authorId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      product: { select: { title: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Мои обращения</h1>
        <p className="text-sm text-muted-foreground">
          Для нового обращения — кнопка «Поддержка» в правом нижнем углу
        </p>
      </div>

      {tickets.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          У вас пока нет обращений.
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => {
            const lastMsg = t.messages[0]
            return (
              <Link
                key={t.id}
                href={`/support/${t.id}`}
                className="block rounded-lg border border-border bg-card p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{t.subject}</p>
                      <Badge variant={STATUS_VARIANTS[t.status] ?? "outline"} className="shrink-0">
                        {STATUS_LABELS[t.status] ?? t.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {CATEGORY_LABELS[t.category] ?? t.category}
                      {t.product && ` · ${t.product.title}`}
                      {" · "}
                      {t._count.messages} {t._count.messages === 1 ? "сообщение" : "сообщений"}
                    </p>
                    {lastMsg && (
                      <p className="text-sm text-muted-foreground mt-1.5 truncate">
                        {lastMsg.isStaff ? "Поддержка: " : "Вы: "}{lastMsg.text}
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
