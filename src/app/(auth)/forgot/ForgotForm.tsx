"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ForgotForm() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (res.status === 429) {
        setError("Слишком много запросов. Попробуйте позже.")
        return
      }
      setSent(true)
    } catch {
      setError("Ошибка соединения")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          Если аккаунт с таким email существует, мы отправили на него ссылку для сброса пароля.
          Проверьте почту (и папку «Спам»).
        </div>
        <Link href="/login" className="text-sm text-primary hover:underline">
          Вернуться ко входу
        </Link>
      </div>
    )
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

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading || !email}>
        {loading ? "Отправка…" : "Прислать ссылку"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Вспомнили пароль?{" "}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Войти
        </Link>
      </p>
    </form>
  )
}
