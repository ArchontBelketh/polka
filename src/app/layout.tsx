import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import { Navbar } from "@/components/layout/Navbar"

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Полка — маркетплейс программных продуктов",
  description: "Готовые программные продукты для российского бизнеса: Telegram-боты, парсеры, Excel-скрипты, автоматизация.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className={`${geist.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Navbar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  )
}
