import type { Metadata } from "next"
import { RequestForm } from "./RequestForm"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

export const metadata: Metadata = {
  title: "Описать задачу",
  description:
    "Опишите задачу по боту, интеграции или автоматизации — мы уточним её и подберём исполнителя. Подбор бесплатный, ответим за 24 часа.",
  alternates: { canonical: `${APP_URL}/request` },
}

export default function RequestPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Опишите задачу</h1>
        <p className="text-muted-foreground">
          Боты, интеграции, автоматизация для бизнеса. Мы уточним задачу и подберём исполнителя из
          проверенных разработчиков. Подбор исполнителя <b>бесплатный</b>, оплату работы вы
          согласуете с исполнителем напрямую. Ответим за 24 часа.
        </p>
      </div>
      <RequestForm />
    </div>
  )
}
