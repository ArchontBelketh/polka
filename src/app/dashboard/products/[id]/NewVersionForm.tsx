"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  productId: string
}

export function NewVersionForm({ productId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [version, setVersion] = useState("")
  const [changelog, setChangelog] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const file = fileRef.current?.files?.[0]
      let s3Key = ""
      let fileName = ""
      let fileSize = 0

      if (file) {
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId,
            type: "version",
            fileName: file.name,
            fileSize: file.size,
            contentType: file.type || "application/octet-stream",
          }),
        })
        const uploadData = await uploadRes.json()
        if (!uploadRes.ok) {
          setError(uploadData.error ?? "Ошибка загрузки файла")
          return
        }

        fileName = file.name
        fileSize = file.size
        s3Key = uploadData.key ?? ""

        if (uploadData.url) {
          const putRes = await fetch(uploadData.url, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type || "application/octet-stream" },
          })
          if (!putRes.ok) {
            setError("Ошибка загрузки файла в хранилище")
            return
          }
        }
      }

      const res = await fetch(`/api/products/${productId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, changelog: changelog || undefined, s3Key, fileName, fileSize }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Ошибка")
        return
      }

      setSuccess(true)
      setVersion("")
      setChangelog("")
      if (fileRef.current) fileRef.current.value = ""
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Загрузить новую версию
      </Button>
    )
  }

  if (success) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400 flex items-center justify-between">
        <span>✓ Версия отправлена на модерацию. Покупатели получат уведомление после одобрения.</span>
        <Button
          variant="ghost"
          size="sm"
          className="text-green-400 hover:text-green-300"
          onClick={() => { setSuccess(false); setOpen(false) }}
        >
          ОК
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
      <h3 className="text-sm font-semibold">Новая версия</h3>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Номер версии *</label>
        <Input
          placeholder="2.0.0"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          required
          className="max-w-[180px]"
        />
        <p className="text-xs text-muted-foreground">Например: 1.1.0, 2.0.0-beta</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Что нового</label>
        <Textarea
          placeholder="Список изменений в этой версии..."
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          rows={4}
          maxLength={2000}
        />
        {changelog.length > 0 && (
          <p className="text-xs text-muted-foreground">{changelog.length}/2000</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Файл обновления</label>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,.py,.js,.ts,.epf,.erf,.xlsm"
          className="block text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1 file:text-xs file:font-medium file:text-foreground hover:file:bg-accent"
        />
        <p className="text-xs text-muted-foreground">Поддерживаемые форматы: .zip, .py, .js, .ts, .epf, .xlsm</p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" size="sm" disabled={loading || !version.trim()}>
          {loading ? "Публикуем…" : "Опубликовать версию"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => { setOpen(false); setError(null) }}
          disabled={loading}
        >
          Отмена
        </Button>
      </div>
    </form>
  )
}
