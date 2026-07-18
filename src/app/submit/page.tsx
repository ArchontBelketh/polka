import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { SubmitForm } from "./SubmitForm"
import { SlotGate } from "./SlotGate"
import { getPlanInfo } from "@/lib/developer-plan"
import { isProfileComplete } from "@/lib/payout-profile"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Загрузить продукт" }

export default async function SubmitPage() {
  const session = await auth()
  if (!session?.user) redirect("/login?callbackUrl=/submit")

  const [plan, profile] = await Promise.all([
    getPlanInfo(session.user.id!),
    db.payoutProfile.findUnique({ where: { userId: session.user.id } }),
  ])
  const hasSlot = plan.isProActive || plan.availableSlots > 0
  const requisitesComplete = isProfileComplete(profile)

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 space-y-1">
        <h1 className="text-2xl font-semibold">Загрузить продукт</h1>
        <p className="text-muted-foreground text-sm">
          Заполните форму — после модерации продукт появится в каталоге.
        </p>
      </div>

      {!requisitesComplete ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Сначала — правовой статус и реквизиты</h2>
          <p className="text-sm text-muted-foreground">
            Чтобы публиковать продукты и получать оплату, укажите свой правовой статус
            (самозанятый, ИП или ООО) и реквизиты. Это требование площадки и закона.
          </p>
          <Button asChild>
            <Link href="/dashboard/requisites">Заполнить реквизиты</Link>
          </Button>
        </div>
      ) : hasSlot ? (
        <SubmitForm />
      ) : (
        <SlotGate
          usedSlots={plan.usedSlots}
          totalSlots={plan.totalSlots}
        />
      )}
    </div>
  )
}
