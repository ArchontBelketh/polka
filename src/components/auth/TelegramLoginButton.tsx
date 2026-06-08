"use client"

import { useEffect, useRef } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

interface TelegramLoginButtonProps {
  callbackUrl?: string
}

// Telegram Login Widget injects a script that calls window.onTelegramAuth
// with the user data when login succeeds.
declare global {
  interface Window {
    onTelegramAuth: (user: Record<string, string | number>) => void
  }
}

export function TelegramLoginButton({ callbackUrl = "/dashboard" }: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

  useEffect(() => {
    if (!botUsername || !containerRef.current) return

    window.onTelegramAuth = async (user) => {
      const res = await signIn("telegram", {
        ...user,
        redirect: false,
      })
      if (res?.ok) {
        router.push(callbackUrl)
        router.refresh()
      }
    }

    const script = document.createElement("script")
    script.src = "https://telegram.org/js/telegram-widget.js?22"
    script.setAttribute("data-telegram-login", botUsername)
    script.setAttribute("data-size", "large")
    script.setAttribute("data-onauth", "onTelegramAuth(user)")
    script.setAttribute("data-request-access", "write")
    script.async = true
    containerRef.current.appendChild(script)

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = ""
    }
  }, [botUsername, callbackUrl, router])

  if (!botUsername) return null

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-muted-foreground">или войдите через</p>
      <div ref={containerRef} />
    </div>
  )
}
