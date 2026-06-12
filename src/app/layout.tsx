import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import { Suspense } from "react"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { EmailVerifyBar } from "@/components/layout/EmailVerifyBar"
import { FeedbackWidgetWrapper } from "@/components/layout/FeedbackWidgetWrapper"

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
        <Suspense fallback={null}>
          <EmailVerifyBar />
        </Suspense>
        <main className="flex-1">{children}</main>
        <Footer />
        <FeedbackWidgetWrapper />
      </body>
    </html>
  )
}
