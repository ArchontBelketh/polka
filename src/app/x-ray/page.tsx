import type { Metadata } from "next"
import { XrayClient } from "./XrayClient"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

export const metadata: Metadata = {
  title: "Проверка кода X-Ray — что делает этот код",
  description:
    "Бесплатная автоматическая проверка Python-кода: куда ходит в интернет, что делает с файлами, запускает ли команды, есть ли пароли и уязвимые библиотеки. Код не сохраняется. Это не гарантия безопасности.",
  alternates: { canonical: `${APP_URL}/x-ray` },
  robots: { index: true, follow: true },
}

export default function XrayPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Что делает этот код?
        </h1>
        <p className="text-muted-foreground">
          Вставьте Python-код или загрузите файл/архив — покажем по фактам: куда он ходит в
          интернет, что делает с файлами, запускает ли команды, есть ли в нём пароли и уязвимые
          библиотеки. Код <b>никогда не исполняется</b>, только статический анализ.
        </p>
      </div>

      <XrayClient />

      <p className="text-xs text-muted-foreground">
        Это автоматический анализ, а не гарантия безопасности. Пока поддерживается Python.
      </p>
    </div>
  )
}
