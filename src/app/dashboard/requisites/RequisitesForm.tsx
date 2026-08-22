"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  PAYER_KIND_LABELS,
  ATTESTATION_TEXT,
  innLength,
  isInnValidForKind,
} from "@/lib/payout-profile"

type Kind = "SELF_EMPLOYED" | "ENTREPRENEUR" | "COMPANY"

interface Props {
  initial: {
    kind: Kind
    displayName: string
    inn: string
    phone: string
    attested: boolean
  } | null
}

export function RequisitesForm({ initial }: Props) {
  const router = useRouter()
  const [kind, setKind] = useState<Kind>(initial?.kind ?? "SELF_EMPLOYED")
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "")
  const [inn, setInn] = useState(initial?.inn ?? "")
  const [phone, setPhone] = useState(initial?.phone ?? "")
  // Уже принятые заверения не требуют повторной галочки, но при изменении данных — да
  const [attest, setAttest] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const nameLabel = kind === "COMPANY" ? "Наименование организации" : "ФИО"
  const innHint = `ИНН — ${innLength(kind)} цифр`
  const innLooksValid = inn.length === 0 || isInnValidForKind(inn, kind)

  async function submit() {
    setError(null)
    if (displayName.trim().length < 2) { setError("Укажите ФИО или наименование"); return }
    if (!isInnValidForKind(inn, kind)) { setError(`Некорректный ИНН (${innHint.toLowerCase()})`); return }
    if (phone.replace(/\D/g, "").length < 10) { setError("Укажите корректный телефон"); return }
    if (!attest) { setError("Необходимо принять заверения"); return }

    setLoading(true)
    try {
      const res = await fetch("/api/developer/requisites", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, displayName: displayName.trim(), inn: inn.trim(), phone: phone.trim(), attest: true }),
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
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Правовой статус</label>
        <select
          value={kind}
          onChange={(e) => { setKind(e.target.value as Kind); setSaved(false) }}
          className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {(Object.keys(PAYER_KIND_LABELS) as Kind[]).map((k) => (
            <option key={k} value={k}>{PAYER_KIND_LABELS[k]}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">{nameLabel}</label>
        <Input
          value={displayName}
          onChange={(e) => { setDisplayName(e.target.value); setSaved(false) }}
          placeholder={kind === "COMPANY" ? "ООО «Ромашка»" : "Иванов Иван Иванович"}
          maxLength={200}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">ИНН</label>
        <Input
          value={inn}
          onChange={(e) => { setInn(e.target.value.replace(/\D/g, "").slice(0, 12)); setSaved(false) }}
          placeholder={innHint}
          inputMode="numeric"
        />
        <p className={`text-xs ${innLooksValid ? "text-muted-foreground" : "text-destructive"}`}>
          {innLooksValid ? innHint : `Проверьте ИНН — ожидается ${innLength(kind)} цифр с корректной контрольной суммой`}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Телефон</label>
        <Input
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setSaved(false) }}
          placeholder="+7 900 000-00-00"
          inputMode="tel"
          maxLength={20}
        />
        <p className="text-xs text-muted-foreground">
          Нужен для чека покупателю (данные поставщика). Виден только площадке и в чеке.
        </p>
      </div>

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={attest}
          onChange={(e) => { setAttest(e.target.checked); setSaved(false) }}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span className="text-muted-foreground">{ATTESTATION_TEXT}</span>
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-500">Реквизиты сохранены.</p>}

      <Button onClick={submit} disabled={loading}>
        {loading ? "Сохраняем…" : "Сохранить реквизиты"}
      </Button>
    </div>
  )
}
