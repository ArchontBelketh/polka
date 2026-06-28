import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SubmitForm } from "./SubmitForm"
import { SlotGate } from "./SlotGate"
import { getPlanInfo } from "@/lib/developer-plan"

export const metadata = { title: "Загрузить продукт" }

export default async function SubmitPage() {
  const session = await auth()
  if (!session?.user) redirect("/login?callbackUrl=/submit")

  const plan = await getPlanInfo(session.user.id!)
  const hasSlot = plan.isProActive || plan.availableSlots > 0

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 space-y-1">
        <h1 className="text-2xl font-semibold">Загрузить продукт</h1>
        <p className="text-muted-foreground text-sm">
          Заполните форму — после модерации продукт появится в каталоге.
        </p>
      </div>

      {hasSlot ? (
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
