"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function AddExecutor() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: "", contact: "", stack: "", inn: "", xrayReportUrl: "", notes: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((p) => ({ ...p, [k]: v }))
  }

  async function submit() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/admin/executors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.name, contact: f.contact,
          stack: f.stack || undefined, inn: f.inn || undefined,
          xrayReportUrl: f.xrayReportUrl || undefined, notes: f.notes || undefined,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(typeof d.error === "string" ? d.error : "Ошибка"); return }
      setF({ name: "", contact: "", stack: "", inn: "", xrayReportUrl: "", notes: "" })
      setOpen(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ Добавить исполнителя</Button>
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-3">
      <h2 className="font-semibold">Новый исполнитель</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input placeholder="Имя *" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <Input placeholder="Контакт (email/telegram) *" value={f.contact} onChange={(e) => set("contact", e.target.value)} />
        <Input placeholder="Стек" value={f.stack} onChange={(e) => set("stack", e.target.value)} />
        <Input placeholder="ИНН (для проверки ФНС)" value={f.inn} onChange={(e) => set("inn", e.target.value)} />
        <Input placeholder="Ссылка на отчёт X-Ray по примеру кода" value={f.xrayReportUrl} onChange={(e) => set("xrayReportUrl", e.target.value)} className="sm:col-span-2" />
        <Input placeholder="Заметки" value={f.notes} onChange={(e) => set("notes", e.target.value)} className="sm:col-span-2" />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={submit} disabled={loading || !f.name || !f.contact}>{loading ? "…" : "Добавить"}</Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>Отмена</Button>
      </div>
    </div>
  )
}
