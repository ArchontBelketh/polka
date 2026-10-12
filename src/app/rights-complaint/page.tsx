import type { Metadata } from "next"
import { ComplaintForm } from "./ComplaintForm"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

export const metadata: Metadata = {
  title: "Жалоба правообладателя",
  description:
    "Форма для правообладателей: сообщите о продукте, нарушающем ваши права. Мы рассмотрим обращение и при обоснованности скроем продукт.",
  alternates: { canonical: `${APP_URL}/rights-complaint` },
}

export default function RightsComplaintPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Жалоба правообладателя</h1>
        <p className="text-muted-foreground">
          Если продукт на ПОЛКЕ нарушает ваши права, заполните форму. По обоснованному обращению мы в
          течение 24 часов скрываем продукт и уведомляем автора. ПОЛКА действует как информационный
          посредник (ст. 1253.1 ГК РФ).
        </p>
      </div>
      <ComplaintForm />
    </div>
  )
}
