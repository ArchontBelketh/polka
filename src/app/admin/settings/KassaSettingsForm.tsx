"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Props {
  initial: {
    enabled: boolean
    publicId: string
    hasSecret: boolean
  }
  innSet: boolean
}

export function KassaSettingsForm({ initial, innSet }: Props) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initial.enabled)
  const [publicId, setPublicId] = useState(initial.publicId)
  const [apiSecret, setApiSecret] = useState("")
  const [hasSecret, setHasSecret] = useState(initial.hasSecret)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function submit() {
    setError(null)
    setSaved(false)
    setLoading(true)
    try {
      const res = await fetch("/api/admin/kassa-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, publicId: publicId.trim(), apiSecret: apiSecret.trim() }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof d.error === "string" ? d.error : "Не удалось сохранить")
        return
      }
      if (apiSecret.trim()) setHasSecret(true)
      setApiSecret("")
      setSaved(true)
      router.refresh()
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.")
    } finally {
      setLoading(false)
    }
  }

  const ready = enabled && publicId.trim() && (hasSecret || apiSecret.trim()) && innSet

  return (
    <div className="space-y-4">
      {!innSet && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          Для чеков нужен ИНН оператора — заполните его в реквизитах выше.
        </div>
      )}

      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => { setEnabled(e.target.checked); setSaved(false) }}
          className="h-4 w-4"
        />
        <span>Бить чеки через кассу</span>
      </label>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Public ID</label>
        <Input
          value={publicId}
          onChange={(e) => { setPublicId(e.target.value); setSaved(false) }}
          placeholder="pk_..."
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">API Secret</label>
        <Input
          type="password"
          value={apiSecret}
          onChange={(e) => { setApiSecret(e.target.value); setSaved(false) }}
          placeholder={hasSecret ? "Секрет сохранён — оставьте пустым, чтобы не менять" : "Вставьте API Secret из ЛК кассы"}
        />
        <p className="text-xs text-muted-foreground">
          {hasSecret ? "Секрет уже сохранён. Введите новый только если хотите заменить." : "Хранится на сервере и наружу не отдаётся."}
        </p>
      </div>

      <div
        className={`rounded-md border px-3 py-2 text-sm ${
          ready
            ? "border-green-500/30 bg-green-500/10 text-green-400"
            : "border-amber-500/30 bg-amber-500/10 text-amber-300"
        }`}
      >
        {ready
          ? "Касса готова — чеки будут формироваться после оплаты."
          : "Касса не активна — чеки не бьются (проверьте флаг, Public ID, секрет и ИНН)."}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-500">Настройки кассы сохранены.</p>}

      <Button onClick={submit} disabled={loading}>
        {loading ? "Сохраняем…" : "Сохранить настройки кассы"}
      </Button>
    </div>
  )
}
