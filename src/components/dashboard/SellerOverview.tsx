import { db } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/utils"
import { isProfileComplete } from "@/lib/payout-profile"

// Render only after the parent verifies the active account's selling permission.
export async function SellerOverview({ userId }: { userId: string }) {
  const [products, payoutProfile] = await Promise.all([
    db.product.findMany({
      where: { authorId: userId },
      select: { id: true, status: true },
    }),
    db.payoutProfile.findUnique({ where: { userId } }),
  ])
  const productIds = products.map((p) => p.id)
  const approvedCount = products.filter((p) => p.status === "APPROVED").length
  const requisitesComplete = isProfileComplete(payoutProfile)

  const [paidPurchases, salesCount, unansweredQuestions, unreadMessages, awaitingConfirmations] = await Promise.all([
    db.purchase.findMany({
      where: { productId: { in: productIds }, status: { in: ["PAID", "DELIVERED"] } },
      include: {
        product: { select: { title: true, slug: true } },
        buyer: { select: { name: true, email: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 10,
    }),
    db.purchase.count({ where: { productId: { in: productIds }, status: { in: ["PAID", "DELIVERED"] } } }),
    db.productQuestion.count({
      where: { productId: { in: productIds }, isHidden: false, answer: null },
    }),
    db.purchaseMessage.count({
      where: {
        isRead: false,
        senderId: { not: userId },
        purchase: { productId: { in: productIds } },
      },
    }),
    db.purchase.count({ where: { status: "AWAITING", product: { authorId: userId } } }),
  ])

  const totalSales = salesCount

  return (
    <section aria-labelledby="seller-heading" className="space-y-6 rounded-2xl border border-border bg-card/40 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="seller-heading" className="text-xl font-semibold">Продажа готового кода</h2>
        <Button asChild>
          <Link href="/submit">+ Загрузить продукт</Link>
        </Button>
      </div>

      {/* Гейт реквизитов */}
      {!requisitesComplete && (
        <Link
          href="/dashboard/requisites"
          className="block rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 hover:bg-amber-500/15"
        >
          <b>Заполните правовой статус и реквизиты</b> — без них нельзя опубликовать продукт. Указать →
        </Link>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Продажи" value={String(totalSales)} />
        <StatCard label="Активных продуктов" value={String(approvedCount)} />
        <StatCard label="Ждут подтверждения" value={String(awaitingConfirmations)} />
      </div>

      {/* Quick links */}
      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" asChild>
          <Link href="/dashboard/products">Мои продукты</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/confirmations">
            Подтверждения оплат {awaitingConfirmations > 0 && `(${awaitingConfirmations})`}
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
        <Button variant="outline" asChild>
          <Link href="/dashboard/requisites">
            Реквизиты {!requisitesComplete && "⚠"}
          </Link>
        </Button>
      </div>

      {/* Recent sales */}
      {paidPurchases.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-semibold">Последние продажи</h3>
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
                  <p className="text-sm font-medium">{formatPrice(p.amount)}</p>
                  <span className="text-xs text-muted-foreground">напрямую автору</span>
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
    </section>
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
