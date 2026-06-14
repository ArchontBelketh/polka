"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Подсказка о разрешённых доменах (опционально). Проверка — на сервере;
// это только UX. Зеркало серверной ALLOWED_EMAIL_DOMAINS.
const ALLOWED_DOMAINS_HINT = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS ?? "")
  .split(",")
  .map((d) => d.trim().replace(/^@/, ""))
  .filter(Boolean)

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [asDeveloper, setAsDeveloper] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, asDeveloper, agreedToTerms: agreed }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Ошибка регистрации")
        return
      }
      // Auto sign-in after registration
      await signIn("credentials", { email, password, redirect: false })
      router.push(asDeveloper ? "/dashboard" : "/catalog")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">Регистрация</h1>
          <p className="text-sm text-muted-foreground">
            Уже есть аккаунт?{" "}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              Войти
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">Имя</label>
            <Input
              id="name"
              placeholder="Иван Иванов"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <Input
              id="email"
              type="email"
              placeholder={ALLOWED_DOMAINS_HINT[0] ? `you@${ALLOWED_DOMAINS_HINT[0]}` : "you@example.com"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {ALLOWED_DOMAINS_HINT.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Только почта: {ALLOWED_DOMAINS_HINT.map((d) => "@" + d).join(", ")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">Пароль</label>
            <Input
              id="password"
              type="password"
              placeholder="Не менее 8 символов"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={asDeveloper}
              onChange={(e) => setAsDeveloper(e.target.checked)}
            />
            <span className="text-sm">Я разработчик — хочу продавать продукты</span>
          </label>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              required
            />
            <span className="text-xs text-muted-foreground">
              Принимаю{" "}
              <Link href="/legal/terms" target="_blank" className="text-primary hover:underline">условия соглашения</Link>,{" "}
              <Link href="/legal/offer" target="_blank" className="text-primary hover:underline">оферту</Link>{" "}
              и даю согласие на{" "}
              <Link href="/legal/privacy" target="_blank" className="text-primary hover:underline">обработку персональных данных</Link>.
            </span>
          </label>

          {error && <p className={cn("text-sm text-red-500")}>{error}</p>}

          <Button type="submit" className="w-full" disabled={loading || !agreed}>
            {loading ? "Создаём аккаунт…" : "Создать аккаунт"}
          </Button>
        </form>
      </div>
    </div>
  )
}
