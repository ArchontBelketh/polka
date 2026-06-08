import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { CouponForm } from "./CouponForm"
import { DeactivateButton, DeleteButton } from "./CouponActions"

export const metadata = { title: "Управление купонами — ПОЛКА" }

function couponStatus(coupon: {
  expiresAt: Date | null
  maxUses: number | null
  usedCount: number
}): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } {
  if (coupon.expiresAt && coupon.expiresAt <= new Date()) {
    return { label: "Истёк", variant: "destructive" }
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { label: "Исчерпан", variant: "destructive" }
  }
  return { label: "Активен", variant: "default" }
}

export default async function CouponsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || user.role !== "ADMIN") redirect("/")

  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } })

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            <a href="/admin" className="hover:underline">← Рабочий стол</a>
          </p>
          <h1 className="text-2xl font-semibold">Купоны</h1>
        </div>
      </div>

      {/* Create form */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold">Создать купон</h2>
        <CouponForm />
      </section>

      {/* Coupon list */}
      <section className="space-y-3">
        <h2 className="font-semibold">Все купоны ({coupons.length})</h2>

        {coupons.length === 0 ? (
          <p className="text-sm text-muted-foreground">Купонов пока нет.</p>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border">
            {coupons.map((c) => {
              const status = couponStatus(c)
              const isActive = status.label === "Активен"
              return (
                <div key={c.id} className="px-4 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-medium text-sm">{c.code}</span>
                      <Badge variant="secondary" className="text-xs">
                        −{c.discountPct}%
                      </Badge>
                      <Badge variant={status.variant} className="text-xs">
                        {status.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Использований: {c.usedCount}{c.maxUses !== null ? ` / ${c.maxUses}` : ""}
                      {c.expiresAt && (
                        <> · До {new Date(c.expiresAt).toLocaleDateString("ru-RU")}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isActive && <DeactivateButton id={c.id} />}
                    <DeleteButton id={c.id} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
