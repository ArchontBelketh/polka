import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { RequisitesForm } from "./RequisitesForm"
import { isProfileComplete } from "@/lib/payout-profile"

export const metadata = { title: "Реквизиты" }

export default async function RequisitesPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["DEVELOPER", "ADMIN"].includes(user.role)) redirect("/dashboard")

  const profile = await db.payoutProfile.findUnique({ where: { userId: session.user.id } })
  const complete = isProfileComplete(profile)

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <a href="/dashboard" className="hover:underline">← Кабинет</a>
        </p>
        <h1 className="text-2xl font-semibold">Правовой статус и реквизиты</h1>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground space-y-2">
        <p>
          Продавая продукты на площадке, вы получаете доход и обязаны иметь статус, позволяющий
          принимать оплату (самозанятый, ИП или ООО), самостоятельно выдавать чек и платить налоги.
        </p>
        <p>
          Эти данные нужны, чтобы публиковать продукты и получать оплату напрямую от покупателей.
          Реквизиты карты/счёта здесь не запрашиваются — платёжного получателя вы подключите через
          платёжный сервис отдельно.
        </p>
      </div>

      {complete ? (
        <div className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-400">
          Профиль заполнен — вы можете публиковать продукты.
        </div>
      ) : (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          Профиль не заполнен. Без него нельзя отправить продукт на публикацию.
        </div>
      )}

      <RequisitesForm
        initial={
          profile
            ? {
                kind: profile.kind,
                displayName: profile.displayName,
                inn: profile.inn,
                phone: profile.phone ?? "",
                attested: !!profile.attestedAt,
              }
            : null
        }
      />
    </div>
  )
}
