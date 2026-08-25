"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AI_PROVIDER_LABELS, type AiProvider } from "@/lib/ai-provider"

interface Props {
  initial: {
    provider: AiProvider
    model: string
    folderId: string
    hasKey: boolean
  }
}

const MODEL_PLACEHOLDER: Record<AiProvider, string> = {
  disabled: "",
  gemini: "gemini-2.5-flash",
  yandexgpt: "yandexgpt-lite",
}

export function AiSettingsForm({ initial }: Props) {
  const router = useRouter()
  const [provider, setProvider] = useState<AiProvider>(initial.provider)
  const [model, setModel] = useState(initial.model)
  const [folderId, setFolderId] = useState(initial.folderId)
  const [apiKey, setApiKey] = useState("")
  const [hasKey, setHasKey] = useState(initial.hasKey)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function submit() {
    setError(null)
    setSaved(false)
    setLoading(true)
    try {
      const res = await fetch("/api/admin/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model: model.trim(), folderId: folderId.trim(), apiKey: apiKey.trim() }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof d.error === "string" ? d.error : "Не удалось сохранить")
        return
      }
      if (apiKey.trim()) setHasKey(true)
      setApiKey("")
      setSaved(true)
      router.refresh()
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.")
    } finally {
      setLoading(false)
    }
  }

  const enabled =
    (provider === "gemini" && (hasKey || apiKey.trim())) ||
    (provider === "yandexgpt" && (hasKey || apiKey.trim()) && folderId.trim())

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Провайдер ИИ</label>
        <select
          value={provider}
          onChange={(e) => { setProvider(e.target.value as AiProvider); setSaved(false) }}
          className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {(Object.keys(AI_PROVIDER_LABELS) as AiProvider[]).map((p) => (
            <option key={p} value={p}>{AI_PROVIDER_LABELS[p]}</option>
          ))}
        </select>
      </div>

      {provider !== "disabled" && (
        <>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">API-ключ</label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setSaved(false) }}
              placeholder={hasKey ? "Ключ сохранён — оставьте пустым, чтобы не менять" : "Вставьте ключ провайдера"}
            />
            <p className="text-xs text-muted-foreground">
              {hasKey ? "Ключ уже сохранён. Введите новый только если хотите заменить." : "Ключ хранится на сервере и наружу не отдаётся."}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Модель <span className="font-normal text-muted-foreground">(опционально)</span></label>
            <Input
              value={model}
              onChange={(e) => { setModel(e.target.value); setSaved(false) }}
              placeholder={MODEL_PLACEHOLDER[provider]}
            />
          </div>

          {provider === "yandexgpt" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Folder ID</label>
              <Input
                value={folderId}
                onChange={(e) => { setFolderId(e.target.value); setSaved(false) }}
                placeholder="b1g..."
              />
            </div>
          )}
        </>
      )}

      <div
        className={`rounded-md border px-3 py-2 text-sm ${
          enabled
            ? "border-green-500/30 bg-green-500/10 text-green-400"
            : "border-amber-500/30 bg-amber-500/10 text-amber-300"
        }`}
      >
        {enabled
          ? "ИИ-ревью включено — услуга видна в карточках товаров."
          : "ИИ-ревью выключено — услуга скрыта из карточек товаров."}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-500">Настройки ИИ сохранены.</p>}

      <Button onClick={submit} disabled={loading}>
        {loading ? "Сохраняем…" : "Сохранить настройки ИИ"}
      </Button>
    </div>
  )
}
