"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { TelegramLoginButton } from "@/components/auth/TelegramLoginButton"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Validate callbackUrl to prevent open redirect to external domains
  const rawCallback = searchParams.get("callbackUrl") ?? ""
  const callbackUrl =
    rawCallback.startsWith("/") && !rawCallback.startsWith("//")
      ? rawCallback
      : "/dashboard"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })
      if (res?.error) {
        if (res.error === "AccessDenied") {
          router.push("/banned")
          return
        }
        setError("Неверный email или пароль")
      } else {
        const sessionRes = await fetch("/api/auth/session")
        const sessionData = await sessionRes.json()
        const role = sessionData?.user?.role
        if (role === "ADMIN" || role === "MODERATOR") {
          router.push("/admin")
        } else {
          router.push(callbackUrl)
        }
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">Пароль</label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <div className="text-right">
          <Link href="/forgot" className="text-xs text-muted-foreground hover:text-foreground">
            Забыли пароль?
          </Link>
        </div>
      </div>

      {error && <p className={cn("text-sm text-red-500")}>{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Вход…" : "Войти"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Нет аккаунта?{" "}
        <Link href="/register" className="text-primary underline-offset-4 hover:underline">
          Зарегистрироваться
        </Link>
      </p>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-2 text-xs text-muted-foreground">или</span>
        </div>
      </div>

      <TelegramLoginButton callbackUrl={callbackUrl} />
    </form>
  )
}
