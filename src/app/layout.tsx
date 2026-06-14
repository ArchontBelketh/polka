import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { Suspense } from "react"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { EmailVerifyBar } from "@/components/layout/EmailVerifyBar"
import { FeedbackWidgetWrapper } from "@/components/layout/FeedbackWidgetWrapper"

export const metadata: Metadata = {
  title: "Полка — маркетплейс программных продуктов",
  description: "Готовые программные продукты для российского бизнеса: Telegram-боты, парсеры, Excel-скрипты, автоматизация.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // In maintenance mode every route is rewritten to /maintenance — render it
  // standalone, without the navbar/footer (which also query auth/DB).
  const maintenance =
    process.env.MAINTENANCE_MODE === "1" || process.env.MAINTENANCE_MODE === "true"

  return (
    <html lang="ru" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {maintenance ? (
          children
        ) : (
          <>
            <Navbar />
            <Suspense fallback={null}>
              <EmailVerifyBar />
            </Suspense>
            <main className="flex-1">{children}</main>
            <Footer />
            <FeedbackWidgetWrapper />
          </>
        )}
      </body>
    </html>
  )
}
