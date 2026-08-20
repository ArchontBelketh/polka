import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { SettingsForm } from "./SettingsForm"

export const metadata = { title: "Настройки — реквизиты" }

export default async function AdminSettingsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || user.role !== "ADMIN") redirect("/")

  const row = await db.operatorSettings.findUnique({ where: { id: "singleton" } })

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <a href="/admin" className="hover:underline">← Рабочий стол</a>
        </p>
        <h1 className="text-2xl font-semibold">Реквизиты оператора</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Эти данные подставляются в оферту, политику ПДн, соглашение и футер сайта.
          Пустые поля не показываются.
        </p>
      </div>

      <SettingsForm initial={row ?? {}} />
    </div>
  )
}
