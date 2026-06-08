"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function PasswordForm() {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  const [current, setCurrent] = useState("")
  const [next,    setNext]    = useState("")
  const [confirm, setConfirm] = useState("")

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("idle")

    if (next.length < 6) {
      setErrorMsg("Новый пароль должен быть не короче 6 символов")
      setStatus("error")
      return
    }
    if (next !== confirm) {
      setErrorMsg("Пароли не совпадают")
      setStatus("error")
      return
    }

    startTransition(async () => {
      const res = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next }),
      })
      if (res.ok) {
        setStatus("ok")
        setCurrent("")
        setNext("")
        setConfirm("")
      } else {
        const data = await res.json()
        setErrorMsg(typeof data.error === "string" ? data.error : "Ошибка смены пароля")
        setStatus("error")
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Текущий пароль</label>
          <Input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Новый пароль</label>
          <Input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Повторите пароль</label>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
      </div>

      {status === "ok" && (
        <p className="text-sm text-green-400">Пароль успешно изменён</p>
      )}
      {status === "error" && (
        <p className="text-sm text-red-400">{errorMsg}</p>
      )}

      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Сохранение…" : "Изменить пароль"}
      </Button>
    </form>
  )
}
