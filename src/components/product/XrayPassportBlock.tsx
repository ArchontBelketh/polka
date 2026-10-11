import type { XrayPassport } from "@/lib/xray/types"
import { FLAG_LABELS } from "@/lib/xray/report"
import { Globe, FileText, Terminal, ShieldAlert } from "lucide-react"

// X-Ray-паспорт в карточке: факты без кода и номеров строк.
export function XrayPassportBlock({ passport }: { passport: XrayPassport }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Что делает этот код</h2>
        <span className="text-xs text-muted-foreground">X-Ray · не гарантия</span>
      </div>

      <ul className="space-y-2 text-sm">
        <li className="flex items-start gap-2">
          <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span>
            {passport.internet.used
              ? `Обращается в интернет${passport.internet.hosts.length ? ": " + passport.internet.hosts.slice(0, 8).join(", ") : ""}`
              : "Не обращается в интернет"}
          </span>
        </li>
        {passport.internet.flags.map((f, i) => (
          <li key={i} className="pl-6 text-xs text-amber-400">⚠ {FLAG_LABELS[f.kind]}: {f.value}</li>
        ))}
        <li className="flex items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{passport.writesFiles ? "Пишет, изменяет или удаляет файлы" : "Не изменяет файлы"}</span>
        </li>
        <li className="flex items-start gap-2">
          <Terminal className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{passport.runsCommands ? "Запускает системные команды" : "Не запускает системные команды"}</span>
        </li>
      </ul>

      {passport.vulns.length > 0 && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-red-400">
            <ShieldAlert className="h-4 w-4" />
            Уязвимые зависимости ({passport.vulns.length})
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {passport.vulns.slice(0, 10).map((v, i) => (
              <li key={i}>{v.package}{v.version ? ` ${v.version}` : ""} — {v.id}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
