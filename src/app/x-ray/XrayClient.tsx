"use client"

import { useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { SmartCaptcha, smartCaptchaEnabled, type SmartCaptchaHandle } from "@/components/ui/smartcaptcha"
import { reachGoal } from "@/lib/metrica"
import {
  FACT_EMPTY, FLAG_LABELS, SECRET_LABELS, SECRET_ACTION, SUSPICIOUS_ACTION, VULN_ACTION,
  totalFindings, formatXrayDate,
} from "@/lib/xray/report"
import type { XrayReport, XrayFinding } from "@/lib/xray/types"

type Mode = "paste" | "file"

export function XrayClient() {
  const [mode, setMode] = useState<Mode>("paste")
  const [code, setCode] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<XrayReport | null>(null)
  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const captchaRef = useRef<SmartCaptchaHandle>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function run() {
    setError(null)
    setReport(null)
    setLoading(true)
    try {
      let res: Response
      if (mode === "file") {
        if (!file) { setError("Выберите файл .py или .zip"); return }
        const fd = new FormData()
        fd.set("file", file)
        if (captchaToken) fd.set("captchaToken", captchaToken)
        res = await fetch("/api/xray", { method: "POST", body: fd })
      } else {
        if (!code.trim()) { setError("Вставьте код"); return }
        res = await fetch("/api/xray", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, captchaToken }),
        })
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.captchaRequired) setCaptchaRequired(true)
        setError(typeof data.error === "string" ? data.error : "Ошибка проверки")
        captchaRef.current?.reset()
        setCaptchaToken(null)
        return
      }
      setReport(data.report as XrayReport)
      reachGoal("xray_check")
      captchaRef.current?.reset()
      setCaptchaToken(null)
    } catch {
      setError("Ошибка соединения")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Приватность */}
      <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        Код удаляется сразу после проверки и не попадает в логи. Не загружайте действующие пароли —
        лучше замените их перед проверкой.
      </p>

      {/* Переключатель режима */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("paste")}
          className={`h-9 px-3 rounded-md border text-sm ${mode === "paste" ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"}`}
        >
          Вставить код
        </button>
        <button
          onClick={() => setMode("file")}
          className={`h-9 px-3 rounded-md border text-sm ${mode === "file" ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"}`}
        >
          Загрузить файл / архив
        </button>
      </div>

      {mode === "paste" ? (
        <Textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Вставьте Python-код…"
          rows={12}
          className="font-mono text-xs"
        />
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 text-center hover:border-primary/50 transition-colors"
        >
          {file ? (
            <p className="text-sm font-medium text-primary">{file.name}</p>
          ) : (
            <>
              <p className="text-muted-foreground">Нажмите, чтобы выбрать файл</p>
              <p className="mt-1 text-xs text-muted-foreground">.py или .zip — до 2 МБ</p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".py,.zip"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      )}

      {captchaRequired && smartCaptchaEnabled && (
        <SmartCaptcha ref={captchaRef} onToken={setCaptchaToken} />
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button onClick={run} disabled={loading} size="lg">
        {loading ? "Анализируем…" : "Проверить код"}
      </Button>

      {report && <ReportView report={report} />}
    </div>
  )
}

// ── Отчёт ──────────────────────────────────────────────────────────────────

function ReportView({ report }: { report: XrayReport }) {
  const f = report.facts
  const total = totalFindings(report)
  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <h2 className="text-lg font-semibold">Что делает этот код</h2>
        <span className="text-xs text-muted-foreground">
          Python · {report.files_analyzed} {fileWord(report.files_analyzed)} · проверено {formatXrayDate(report.osvCheckedAt)}
        </span>
      </div>

      <Fact title="Интернет" items={f.internet} empty={FACT_EMPTY.internet}>
        {(report.addresses.urls.length > 0 || report.addresses.ips.length > 0) && (
          <p className="mt-2 text-xs text-muted-foreground">
            Адреса: {[...report.addresses.urls, ...report.addresses.ips].join(", ")}
          </p>
        )}
        {report.addresses.flags.map((fl, i) => (
          <p key={i} className="mt-1 text-xs text-amber-400">⚠ {FLAG_LABELS[fl.kind]}: {fl.value}</p>
        ))}
      </Fact>

      <Fact title="Файлы" items={f.files} empty={FACT_EMPTY.files} />
      <Fact title="Команды" items={f.commands} empty={FACT_EMPTY.commands} />

      <Fact title="Секреты" items={f.secrets} empty={FACT_EMPTY.secrets} render={(x) => (
        <>
          <span className="text-foreground">{SECRET_LABELS[x.kind] ?? "Секрет"}: </span>
          <code className="text-amber-300">{x.detail}</code>
          <span className="ml-1 text-muted-foreground">({x.file}:{x.line})</span>
        </>
      )}>
        {f.secrets.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{SECRET_ACTION}</p>}
      </Fact>

      {/* Зависимости / уязвимости */}
      <div>
        <h3 className="font-medium text-foreground">Зависимости</h3>
        {report.vulns.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">{FACT_EMPTY.dependencies}</p>
        ) : (
          <ul className="mt-1 space-y-1.5">
            {report.vulns.map((v, i) => (
              <li key={i} className="text-sm">
                <span className="text-red-400 font-medium">{v.package}{v.version ? ` ${v.version}` : ""}</span>
                {" — "}<span className="text-muted-foreground">{v.summary || "известная уязвимость"}</span>{" "}
                <a href={v.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{v.id}</a>
              </li>
            ))}
            <li className="text-xs text-muted-foreground">{VULN_ACTION}</li>
          </ul>
        )}
      </div>

      {/* Подозрительное */}
      {f.suspicious.length > 0 && (
        <Fact title="Подозрительное" items={f.suspicious} empty="">
          <p className="mt-2 text-xs text-muted-foreground">{SUSPICIOUS_ACTION}</p>
        </Fact>
      )}

      {report.files_skipped.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Не проанализированы (бинарные/крупные): {report.files_skipped.join(", ")}
        </p>
      )}

      {/* Подвал */}
      <div className="border-t border-border pt-3 text-xs text-muted-foreground space-y-1">
        <p>Это автоматический анализ, а не гарантия безопасности. Найдено сигналов: {total}.</p>
        <p>База уязвимостей обновлена {formatXrayDate(report.osvCheckedAt)}. Источник данных: OSV (osv.dev).</p>
      </div>

      {/* Кнопки под отчётом (ТЗ 7.8) */}
      <div className="flex flex-wrap gap-3 border-t border-border pt-4">
        <Button asChild>
          <Link href="/services/order?kind=ai-audit" onClick={() => reachGoal("service_ai_audit")}>Глубокий AI-аудит — 390 ₽</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/services/order?kind=expert-review" onClick={() => reachGoal("service_expert_review")}>Проверить работу подрядчика с экспертом</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/catalog" onClick={() => reachGoal("xray_to_catalog")}>Проверенные решения на ПОЛКЕ</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/request" onClick={() => reachGoal("xray_need_help")}>Нужна помощь с исправлением</Link>
        </Button>
      </div>
    </section>
  )
}

function Fact({
  title, items, empty, render, children,
}: {
  title: string
  items: XrayFinding[]
  empty: string
  render?: (x: XrayFinding) => ReactNode
  children?: ReactNode
}) {
  return (
    <div>
      <h3 className="font-medium text-foreground">{title}</h3>
      {items.length === 0 ? (
        empty ? <p className="mt-1 text-sm text-muted-foreground">{empty}</p> : null
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((x, i) => (
            <li key={i} className="text-sm">
              {render ? render(x) : (
                <>
                  <code className="text-foreground">{x.detail}</code>
                  <span className="ml-1 text-muted-foreground">({x.file}:{x.line})</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {children}
    </div>
  )
}

function fileWord(n: number): string {
  const m10 = n % 10, m100 = n % 100
  if (m100 >= 11 && m100 <= 14) return "файлов"
  if (m10 === 1) return "файл"
  if (m10 >= 2 && m10 <= 4) return "файла"
  return "файлов"
}
