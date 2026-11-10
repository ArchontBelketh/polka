import type { Metadata } from "next"
import { RequestForm } from "./RequestForm"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

export const metadata: Metadata = {
  title: "Описать задачу",
  description:
    "Опишите задачу по разработке бота, интеграции или автоматизации. Укажите ожидаемый результат, платформу, бюджет и срок — мы уточним детали по вашему контакту.",
  alternates: { canonical: `${APP_URL}/request` },
}

export default function RequestPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Опишите задачу</h1>
        <p className="text-muted-foreground">
          Бот, интеграция или автоматизация для бизнеса. Расскажите, что должно получиться,
          укажите платформу, бюджет и срок. Мы свяжемся по вашему контакту, чтобы уточнить детали.
          Стоимость и условия работы вы согласуете с исполнителем напрямую.
        </p>
      </div>
      <RequestForm />
    </div>
  )
}
