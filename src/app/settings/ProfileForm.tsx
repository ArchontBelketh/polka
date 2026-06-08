"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Props {
  name:           string | null
  telegramHandle: string | null
  phone:          string | null
  bio:            string | null
  isDeveloper:    boolean
}

export function ProfileForm({ name, telegramHandle, phone, bio, isDeveloper }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  const [nameVal,      setNameVal]      = useState(name           ?? "")
  const [tgVal,        setTgVal]        = useState(telegramHandle ?? "")
  const [phoneVal,     setPhoneVal]     = useState(phone          ?? "")
  const [bioVal,       setBioVal]       = useState(bio            ?? "")

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("idle")
    startTransition(async () => {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:           nameVal.trim()  || null,
          telegramHandle: tgVal.trim().replace(/^@/, "") || null,
          phone:          phoneVal.trim() || null,
          bio:            isDeveloper ? (bioVal.trim() || null) : undefined,
        }),
      })
      if (res.ok) {
        setStatus("ok")
        router.refresh()
      } else {
        const data = await res.json()
        setErrorMsg(typeof data.error === "string" ? data.error : "Ошибка сохранения")
        setStatus("error")
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Имя</label>
          <Input
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            placeholder="Ваше имя"
            maxLength={100}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Telegram</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
            <Input
              value={tgVal.replace(/^@/, "")}
              onChange={(e) => setTgVal(e.target.value.replace(/^@/, ""))}
              placeholder="username"
              maxLength={64}
              className="pl-7"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Телефон</label>
          <Input
            value={phoneVal}
            onChange={(e) => setPhoneVal(e.target.value)}
            placeholder="+7 999 000 00 00"
            type="tel"
            maxLength={32}
          />
        </div>
      </div>

      {isDeveloper && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">О себе</label>
          <textarea
            value={bioVal}
            onChange={(e) => setBioVal(e.target.value)}
            placeholder="Коротко о себе, своих навыках и проектах…"
            maxLength={1000}
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground text-right">{bioVal.length}/1000</p>
        </div>
      )}

      {status === "ok" && (
        <p className="text-sm text-green-400">Сохранено</p>
      )}
      {status === "error" && (
        <p className="text-sm text-red-400">{errorMsg}</p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Сохранение…" : "Сохранить"}
      </Button>
    </form>
  )
}
