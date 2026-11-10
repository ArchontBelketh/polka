import type { Metadata } from "next"
import HomeLanding from "@/components/home/HomeLanding"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"
const title = "CYBERПОЛКА — готовый код и разработка под вашу задачу"
const description = "Готовые боты, скрипты, модули и интеграции для бизнеса. Найдите подходящий код или опишите задачу на разработку. Один аккаунт для покупателей, заказчиков и разработчиков."

export const revalidate = 300

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description,
    url: APP_URL,
    images: [{ url: `${APP_URL}/og-default.svg`, width: 1200, height: 630 }],
    type: "website",
  },
  twitter: { card: "summary_large_image", title, description, images: [`${APP_URL}/og-default.svg`] },
}

export default HomeLanding
