import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { PAYER_KIND_LABELS } from "@/lib/payout-profile"
import { VerifyButton } from "./VerifyButton"

export const metadata = { title: "Подтверждение самозанятости" }

export default async function AdminSelfEmployedPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const me = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!me || !["ADMIN", "MODERATOR"].includes(me.role)) redirect("/")

  const profiles = await db.payoutProfile.findMany({
    orderBy: [{ verified: "asc" }, { createdAt: "desc" }],
    include: { user: { select: { id: true, email: true, name: true } } },
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <a href="/admin" className="hover:underline">← Рабочий стол</a>
        </p>
        <h1 className="text-2xl font-semibold">Подтверждение самозанятости</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Проверка статуса НПД по ИНН через сервис ФНС. Для ИП/ООО проверка недоступна
          (там другой контроль). «Проверено» ставится, если ИНН — действующий самозанятый.
        </p>
      </div>

      {profiles.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">Налоговых профилей ещё нет.</div>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border">
          {profiles.map((p) => {
            const isSelfEmployed = p.kind === "SELF_EMPLOYED"
            return (
              <div key={p.id} className="px-4 py-3 flex items-start gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{p.displayName}</span>
                    {p.verified ? (
                      <Badge variant="default" className="text-xs">Проверено</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Не проверено</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {PAYER_KIND_LABELS[p.kind]} · ИНН {p.inn} ·{" "}
                    {p.user.email ?? p.user.name ?? p.userId}
                  </p>
                </div>
                {isSelfEmployed ? (
                  <VerifyButton userId={p.userId} />
                ) : (
                  <span className="text-xs text-muted-foreground shrink-0 mt-1.5">не самозанятый</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
