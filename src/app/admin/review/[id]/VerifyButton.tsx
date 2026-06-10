"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ShieldCheck, ShieldOff } from "lucide-react"

interface VerifyButtonProps {
  productId: string
  initialVerified: boolean
}

export function VerifyButton({ productId, initialVerified }: VerifyButtonProps) {
  const router = useRouter()
  const [verified, setVerified] = useState(initialVerified)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/moderation/${productId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "VERIFIED", verified: !verified }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Не удалось сохранить")
        return
      }
      setVerified(!verified)
      router.refresh()
    } catch {
      setError("Ошибка соединения")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-3">
      <h2 className="font-semibold">Проверка работоспособности</h2>
      <p className="text-sm text-muted-foreground">
        {verified
          ? "Вы подтвердили, что установили и запустили продукт. Покупатели видят бейдж «Проверено вручную»."
          : "Если вы скачали, установили и убедились, что продукт работает — отметьте это. У покупателей появится бейдж доверия."}
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button
        variant={verified ? "outline" : "default"}
        onClick={toggle}
        disabled={loading}
        className={verified ? "" : "bg-green-600 hover:bg-green-700 text-white"}
      >
        {verified ? (
          <>
            <ShieldOff className="mr-1.5 h-4 w-4" />
            {loading ? "…" : "Снять отметку"}
          </>
        ) : (
          <>
            <ShieldCheck className="mr-1.5 h-4 w-4" />
            {loading ? "…" : "Подтвердить работоспособность"}
          </>
        )}
      </Button>
    </section>
  )
}
