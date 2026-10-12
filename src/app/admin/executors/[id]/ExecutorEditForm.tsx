"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

export interface ExecutorData {
  id: string
  name: string
  contact: string
  stack: string
  active: boolean
  inn: string
  taxStatus: string
  taxVerified: boolean
  taxCheckedAt: string | null
  xrayReportUrl: string
  freeRequestsLeft: number
  requestsSent: number
  ordersTaken: number
  relayCount: number
  notes: string
}

export function ExecutorEditForm({ executor }: { executor: ExecutorData }) {
  const router = useRouter()
  const [f, setF] = useState(executor)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  function set<K extends keyof ExecutorData>(k: K, v: ExecutorData[K]) {
    setF((p) => ({ ...p, [k]: v }))
  }

  async function save() {
    setError(null); setMsg(null); setLoading(true)
    try {
      const res = await fetch(`/api/admin/executors/${executor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.name, contact: f.contact, stack: f.stack, active: f.active,
          inn: f.inn, taxStatus: f.taxStatus, xrayReportUrl: f.xrayReportUrl,
          freeRequestsLeft: f.freeRequestsLeft, requestsSent: f.requestsSent,
          ordersTaken: f.ordersTaken, relayCount: f.relayCount, notes: f.notes,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(typeof d.error === "string" ? d.error : "Ошибка"); return }
      setMsg("Сохранено.")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function verifyFns() {
    setError(null); setMsg(null); setVerifying(true)
    try {
      const res = await fetch(`/api/admin/executors/${executor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verifyFns: true, inn: f.inn }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(typeof d.error === "string" ? d.error : "Ошибка проверки"); return }
      setMsg(d.isSelfEmployed ? "ФНС: подтверждён статус самозанятого ✓" : "ФНС: статус самозанятого не подтверждён")
      router.refresh()
    } finally {
      setVerifying(false)
    }
  }

  async function remove() {
    if (!confirm("Удалить исполнителя из пула?")) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/executors/${executor.id}`, { method: "DELETE" })
      if (res.ok) router.push("/admin/executors")
    } finally {
      setLoading(false)
    }
  }

  const num = (v: string) => Math.max(0, parseInt(v || "0", 10) || 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5"><Label>Имя</Label><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Контакт</Label><Input value={f.contact} onChange={(e) => set("contact", e.target.value)} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label>Стек</Label><Input value={f.stack} onChange={(e) => set("stack", e.target.value)} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label>Ссылка на отчёт X-Ray по примеру кода</Label><Input value={f.xrayReportUrl} onChange={(e) => set("xrayReportUrl", e.target.value)} placeholder="https://…" /></div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4" />
        Дежурный (принимает заявки)
      </label>

      {/* Налоговый статус + ФНС */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-medium">Статус самозанятого / ИП</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>ИНН</Label><Input value={f.inn} onChange={(e) => set("inn", e.target.value.replace(/\D/g, "").slice(0, 12))} inputMode="numeric" /></div>
          <div className="space-y-1.5"><Label>Статус (ярлык)</Label><Input value={f.taxStatus} onChange={(e) => set("taxStatus", e.target.value)} placeholder="Самозанятый / ИП" /></div>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={verifyFns} disabled={verifying}>
            {verifying ? "Проверка…" : "Проверить через ФНС"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {f.taxVerified ? "Подтверждён" : "Не подтверждён"}
            {f.taxCheckedAt && ` · ${new Date(f.taxCheckedAt).toLocaleDateString("ru-RU")}`}
          </span>
        </div>
      </div>

      {/* Счётчики */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1.5"><Label className="text-xs">Бесплатных заявок</Label><Input type="number" value={f.freeRequestsLeft} onChange={(e) => set("freeRequestsLeft", num(e.target.value))} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Отправлено</Label><Input type="number" value={f.requestsSent} onChange={(e) => set("requestsSent", num(e.target.value))} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Взято заказов</Label><Input type="number" value={f.ordersTaken} onChange={(e) => set("ordersTaken", num(e.target.value))} /></div>
        <div className="space-y-1.5"><Label className="text-xs">«Эстафета»</Label><Input type="number" value={f.relayCount} onChange={(e) => set("relayCount", num(e.target.value))} /></div>
      </div>

      <div className="space-y-1.5"><Label>Заметки</Label><Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={4} /></div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {msg && <p className="text-sm text-green-500">{msg}</p>}

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={loading}>{loading ? "Сохранение…" : "Сохранить"}</Button>
        <Button variant="destructive" onClick={remove} disabled={loading}>Удалить</Button>
      </div>
    </div>
  )
}
