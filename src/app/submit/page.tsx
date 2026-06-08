import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SubmitForm } from "./SubmitForm"

export const metadata = { title: "Загрузить продукт — ПОЛКА" }

export default async function SubmitPage() {
  const session = await auth()
  if (!session?.user) redirect("/login?callbackUrl=/submit")

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 space-y-1">
        <h1 className="text-2xl font-semibold">Загрузить продукт</h1>
        <p className="text-muted-foreground text-sm">
          Заполните форму — после модерации продукт появится в каталоге.
        </p>
      </div>
      <SubmitForm />
    </div>
  )
}
