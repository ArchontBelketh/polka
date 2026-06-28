import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/utils"
import { developerPayout } from "@/lib/escrow"
import { getPlanInfo } from "@/lib/developer-plan"
import { PlanSection } from "./PlanSection"

export const metadata = { title: "Кабинет" }

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user) redirect("/login")

  if (user.role === "MODERATOR") redirect("/admin")
  if (!["DEVELOPER", "ADMIN"].includes(user.role)) redirect("/purchases")

  const [products, planInfo] = await Promise.all([
    db.product.findMany({
      where: { authorId: session.user.id },
      select: { id: true, status: true },
    }),
    getPlanInfo(session.user.id!),
  ])
  const productIds = products.map((p) => p.id)
  const approvedCount = products.filter((p) => p.status === "APPROVED").length

  const now = new Date()

  const [paidPurchases, deliveredPurchases, pendingEscrow, unansweredQuestions, unreadMessages] = await Promise.all([
    db.purchase.findMany({
      where: { productId: { in: productIds }, status: { in: ["PAID", "DELIVERED"] } },
      include: {
        product: { select: { title: true, slug: true } },
        buyer: { select: { name: true, email: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 10,
    }),
    db.purchase.count({ where: { productId: { in: productIds }, status: "DELIVERED" } }),
    db.purchase.findMany({
      where: { productId: { in: productIds }, status: "PAID", escrowUntil: { gt: now } },
      select: { amount: true, escrowUntil: true },
    }),
    db.productQuestion.count({
      where: { productId: { in: productIds }, isHidden: false, answer: null },
    }),
    db.purchaseMessage.count({
      where: {
        isRead: false,
        senderId: { not: session.user.id },
        purchase: { productId: { in: productIds } },
      },
    }),
  ])

  const totalSales = paidPurchases.filter((p) => p.status === "PAID" || p.status === "DELIVERED").length
  const escrowAmount = pendingEscrow.reduce((sum, p) => sum + developerPayout(p.amount), 0)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Кабинет разработчика</h1>
        <Button asChild>
          <Link href="/submit">+ Загрузить продукт</Link>
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Баланс" value={formatPrice(user.balance)} />
        <StatCard label="В ожидании" value={formatPrice(escrowAmount)} hint="удержание 7 дней" />
        <StatCard label="Продажи" value={String(totalSales)} />
        <StatCard label="Активных продуктов" value={String(approvedCount)} />
      </div>

      {/* Plan */}
      <PlanSection
        plan={planInfo.plan}
        isProActive={planInfo.isProActive}
        totalSlots={planInfo.totalSlots}
        usedSlots={planInfo.usedSlots}
        proUntil={planInfo.proUntil ? planInfo.proUntil.toISOString() : null}
      />

      {/* Quick links */}
      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" asChild>
          <Link href="/dashboard/products">Мои продукты</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/payouts">
            Вывод средств {user.balance > 0 && `(${formatPrice(user.balance)})`}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/questions">
            Вопросы {unansweredQuestions > 0 && `(${unansweredQuestions})`}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/messages">
            Сообщения {unreadMessages > 0 && `(${unreadMessages})`}
          </Link>
        </Button>
      </div>

      {/* Recent sales */}
      {paidPurchases.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Последние продажи</h2>
          <div className="rounded-lg border border-border divide-y divide-border">
            {paidPurchases.map((p) => (
              <div key={p.id} className="px-4 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.product.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.buyer.name ?? p.buyer.email} ·{" "}
                    {p.paidAt ? new Date(p.paidAt).toLocaleDateString("ru-RU") : "—"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium">{formatPrice(developerPayout(p.amount))}</p>
                  <Badge variant={p.status === "DELIVERED" ? "secondary" : "outline"} className="text-xs">
                    {p.status === "DELIVERED" ? "Выплачено" : "В ожидании"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {paidPurchases.length === 0 && (
        <div className="py-16 text-center text-muted-foreground space-y-2">
          <p>Продаж пока нет.</p>
          {approvedCount === 0 && (
            <p className="text-sm">Загрузите и опубликуйте продукт, чтобы начать продавать.</p>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
