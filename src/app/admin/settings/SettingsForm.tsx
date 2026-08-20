"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Fields = {
  name: string; inn: string; ogrn: string; bankAccount: string
  address: string; email: string; phone: string; revisionDate: string
}

const LABELS: { key: keyof Fields; label: string; placeholder: string }[] = [
  { key: "name", label: "Наименование", placeholder: "ИП Иванов Иван Иванович / ООО «Ромашка»" },
  { key: "inn", label: "ИНН", placeholder: "1234567890" },
  { key: "ogrn", label: "ОГРН / ОГРНИП", placeholder: "1234567890123" },
  { key: "bankAccount", label: "Расчётный счёт", placeholder: "40802810…" },
  { key: "address", label: "Адрес", placeholder: "г. Москва, …" },
  { key: "email", label: "Email", placeholder: "support@cyberpolka.store" },
  { key: "phone", label: "Телефон", placeholder: "+7 …" },
  { key: "revisionDate", label: "Дата редакции документов", placeholder: "1 сентября 2026 г." },
]

export function SettingsForm({ initial }: { initial: Partial<Record<keyof Fields, string | null>> }) {
  const router = useRouter()
  const [v, setV] = useState<Fields>({
    name: initial.name ?? "", inn: initial.inn ?? "", ogrn: initial.ogrn ?? "",
    bankAccount: initial.bankAccount ?? "", address: initial.address ?? "",
    email: initial.email ?? "", phone: initial.phone ?? "", revisionDate: initial.revisionDate ?? "",
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setLoading(true); setError(null); setSaved(false)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(typeof d.error === "string" ? d.error : "Не удалось сохранить")
        return
      }
      setSaved(true)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {LABELS.map(({ key, label, placeholder }) => (
        <div key={key} className="space-y-1.5">
          <label className="text-sm font-medium">{label}</label>
          <Input
            value={v[key]}
            onChange={(e) => { setV({ ...v, [key]: e.target.value }); setSaved(false) }}
            placeholder={placeholder}
            maxLength={300}
          />
        </div>
      ))}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-500">Сохранено.</p>}

      <Button onClick={save} disabled={loading}>
        {loading ? "Сохраняем…" : "Сохранить реквизиты"}
      </Button>
    </div>
  )
}
