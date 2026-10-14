"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function DeliveryUpload({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function upload() {
    if (!file) { setError("Выберите файл .py или .zip"); return }
    setError(null)
    setLoading(true)
    try {
      const fd = new FormData()
      fd.set("file", file)
      const res = await fetch(`/api/admin/requests/${requestId}/delivery`, { method: "POST", body: fd })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof d.error === "string" ? d.error : "Ошибка")
        return
      }
      setFile(null)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => fileRef.current?.click()}
        className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border p-4 text-center text-sm hover:border-primary/50"
      >
        {file ? <span className="text-primary">{file.name}</span> : <span className="text-muted-foreground">Выбрать сданную работу (.py / .zip, до 2 МБ)</span>}
        <input ref={fileRef} type="file" accept=".py,.zip" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button onClick={upload} disabled={loading} size="sm">{loading ? "Проверяем…" : "Загрузить и проверить (X-Ray)"}</Button>
    </div>
  )
}
