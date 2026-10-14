"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Props {
  initial: { relaySlaEnabled: boolean; relaySlaDays: number }
}

export function RelaySettingsForm({ initial }: Props) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initial.relaySlaEnabled)
  const [days, setDays] = useState(String(initial.relaySlaDays))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function submit() {
    setError(null)
    setSaved(false)
    const n = parseInt(days, 10)
    if (!Number.isFinite(n) || n < 1 || n > 60) { setError("Срок — от 1 до 60 дней"); return }
    setLoading(true)
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relaySlaEnabled: enabled, relaySlaDays: n }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof d.error === "string" ? d.error : "Не удалось сохранить")
        return
      }
      setSaved(true)
      router.refresh()
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); setSaved(false) }} className="mt-1" />
        <span>
          Показывать срок замены на сайте
          <span className="block text-xs text-muted-foreground">
            Включайте, только когда в пуле есть 3–5 дежурных. Пока выключено — на странице правил
            написано «подберём замену» без обещания срока.
          </span>
        </span>
      </label>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Срок подбора замены, дней</label>
        <Input
          type="number"
          min={1}
          max={60}
          value={days}
          onChange={(e) => { setDays(e.target.value); setSaved(false) }}
          className="max-w-[120px]"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-500">Настройки «Эстафеты» сохранены.</p>}

      <Button onClick={submit} disabled={loading}>{loading ? "Сохраняем…" : "Сохранить"}</Button>
    </div>
  )
}
