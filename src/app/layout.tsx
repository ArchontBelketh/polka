import type { Metadata } from "next"
import "./globals.css"
import { Suspense } from "react"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { EmailVerifyBar } from "@/components/layout/EmailVerifyBar"
import { FeedbackWidgetWrapper } from "@/components/layout/FeedbackWidgetWrapper"

export const metadata: Metadata = {
  // Вкладка: по умолчанию (и на главной) — просто «CYBERПОЛКА»;
  // внутренние страницы добавляют свой раздел: «Каталог — CYBERПОЛКА».
  title: {
    default: "CYBERПОЛКА",
    template: "%s — CYBERПОЛКА",
  },
  description: "Готовые программные продукты для российского бизнеса: Telegram-боты, парсеры, Excel-скрипты, автоматизация. С проверкой кода и ручной модерацией.",
  // favicon.ico авто-эмитится из src/app; остальное объявляем явно (иначе Next,
  // увидев metadata.icons, перестаёт авто-линковать icon.svg/apple-icon).
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    other: [{ rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#6c4bf5" }],
  },
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
    <html lang="ru" className="h-full antialiased dark">
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
