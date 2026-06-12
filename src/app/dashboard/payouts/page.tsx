import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/utils"
import { PayoutRequestForm } from "./PayoutRequestForm"

export const metadata = { title: "Вывод средств — ПОЛКА" }

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Ожидает",
  PROCESSING: "В обработке",
  PAID: "Выплачено",
  REJECTED: "Отклонено (возвращено на баланс)",
}
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  PROCESSING: "secondary",
  PAID: "default",
  REJECTED: "destructive",
}

export default async function PayoutsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["DEVELOPER", "ADMIN"].includes(user.role)) {
    redirect("/dashboard")
  }

  const payouts = await db.payout.findMany({
    where: { developerId: session.user.id },
    orderBy: { requestedAt: "desc" },
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <a href="/dashboard" className="hover:underline">← Кабинет</a>
        </p>
        <h1 className="text-2xl font-semibold">Вывод средств</h1>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-2">
        <p className="text-sm text-muted-foreground">Доступный баланс</p>
        <p className="text-3xl font-bold">{formatPrice(user.balance)}</p>
      </div>

      {user.balance > 0 ? (
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="font-semibold">Новый запрос</h2>
          <PayoutRequestForm balance={user.balance} />
        </section>
      ) : (
        <div className="rounded-lg border border-border bg-card px-5 py-8 text-center text-muted-foreground text-sm">
          Баланс пуст. Средства появятся после завершения периода удержания (7 дней с момента покупки).
        </div>
      )}

      {payouts.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">История выводов</h2>
          <div className="rounded-lg border border-border divide-y divide-border">
            {payouts.map((p) => (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{formatPrice(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.requestedAt).toLocaleDateString("ru-RU")}
                    {p.paidAt && <> → {new Date(p.paidAt).toLocaleDateString("ru-RU")}</>}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANTS[p.status] ?? "outline"}>
                  {STATUS_LABELS[p.status] ?? p.status}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
