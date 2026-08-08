"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface CodeFile {
  path: string
  size: number
  content?: string
  binary?: boolean
  truncated?: boolean
  skipped?: string
}
interface CodeResult {
  kind: "single" | "archive" | "unsupported"
  files: CodeFile[]
  note?: string
}

function fmtSize(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} МБ`
  if (n >= 1024) return `${(n / 1024).toFixed(1)} КБ`
  return `${n} Б`
}

export function CodeViewer({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<CodeResult | null>(null)
  const [active, setActive] = useState(0)

  async function load() {
    setOpen(true)
    if (data || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/products/${productId}/code`)
      const d = await res.json()
      if (!res.ok) {
        setError(typeof d.error === "string" ? d.error : "Не удалось загрузить код")
        return
      }
      setData(d as CodeResult)
    } catch {
      setError("Ошибка сети при загрузке кода")
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={load}>
        Показать код
      </Button>
    )
  }

  const file = data?.files[active]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {loading ? "Загрузка…" : data ? `${data.files.length} файл(ов)` : ""}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Скрыть</Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {data?.note && <p className="text-xs text-muted-foreground">{data.note}</p>}

      {data && data.files.length === 0 && (
        <p className="text-sm text-muted-foreground">Файлы для просмотра не найдены.</p>
      )}

      {data && data.files.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,220px)_1fr] gap-3">
          {/* Список файлов (для архива) */}
          {data.files.length > 1 && (
            <div className="rounded-md border border-border bg-card max-h-[520px] overflow-auto">
              <ul className="text-xs">
                {data.files.map((f, i) => (
                  <li key={i}>
                    <button
                      onClick={() => setActive(i)}
                      className={`w-full text-left px-2.5 py-1.5 font-mono truncate transition-colors ${
                        i === active ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                      }`}
                      title={f.path}
                    >
                      {f.path}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Код активного файла */}
          <div className="min-w-0 rounded-md border border-border bg-[#0d1117]">
            {file && (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
                  <span className="text-xs font-mono text-muted-foreground truncate">{file.path}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{fmtSize(file.size)}</span>
                </div>
                {file.skipped ? (
                  <p className="p-3 text-sm text-muted-foreground">Не показан: {file.skipped}</p>
                ) : file.binary ? (
                  <p className="p-3 text-sm text-muted-foreground">Бинарный файл — предпросмотр недоступен.</p>
                ) : (
                  <CodeBlock content={file.content ?? ""} truncated={file.truncated} />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CodeBlock({ content, truncated }: { content: string; truncated?: boolean }) {
  const lines = content.split("\n")
  return (
    <div className="overflow-auto max-h-[520px] text-xs leading-relaxed">
      <pre className="min-w-full w-max">
        <code className="grid grid-cols-[auto_1fr]">
          {lines.map((line, i) => (
            <div key={i} className="contents">
              <span className="select-none px-3 text-right text-muted-foreground/50 tabular-nums border-r border-white/5">
                {i + 1}
              </span>
              <span className="px-3 whitespace-pre text-slate-200 font-mono">{line || " "}</span>
            </div>
          ))}
        </code>
      </pre>
      {truncated && (
        <p className="px-3 py-2 text-xs text-yellow-400/80 border-t border-white/5">
          Файл обрезан для просмотра. Полную версию можно скачать из файлов продукта.
        </p>
      )}
    </div>
  )
}
