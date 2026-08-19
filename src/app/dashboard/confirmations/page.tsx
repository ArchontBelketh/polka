import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { formatPrice } from "@/lib/utils"
import { ConfirmPaymentButton } from "./ConfirmPaymentButton"

export const metadata = { title: "Подтверждения оплаты" }

export default async function ConfirmationsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["DEVELOPER", "ADMIN"].includes(user.role)) redirect("/dashboard")

  // Заявки (AWAITING) по продуктам этого разработчика
  const requests = await db.purchase.findMany({
    where: { status: "AWAITING", product: { authorId: session.user.id } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      amount: true,
      createdAt: true,
      buyer: { select: { name: true, email: true } },
      product: { select: { title: true, slug: true } },
    },
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <a href="/dashboard" className="hover:underline">← Кабинет</a>
        </p>
        <h1 className="text-2xl font-semibold">Подтверждения оплаты</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Заявки по продуктам с прямой оплатой. Получите оплату по своим реквизитам и подтвердите —
          после этого покупателю откроется скачивание.
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">Заявок на подтверждение нет.</div>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border">
          {requests.map((r) => (
            <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Link href={`/product/${r.product.slug}`} className="font-medium hover:underline truncate block">
                  {r.product.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {r.buyer.name ?? r.buyer.email} · {formatPrice(r.amount)} ·{" "}
                  {new Date(r.createdAt).toLocaleDateString("ru-RU")}
                </p>
              </div>
              <div className="shrink-0">
                <ConfirmPaymentButton purchaseId={r.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
