// Результат Python-анализатора (xray_analyze.py) и обогащённый отчёт X-Ray.

export interface XrayFinding {
  file: string
  line: number
  kind: string
  detail: string
}

export type XrayFlagKind = "bare_ip" | "pastebin" | "shortener" | "tunnel" | "dyndns"

export interface XrayAddressFlag {
  value: string
  kind: XrayFlagKind
  file?: string
  line?: number
}

export interface XrayDependency {
  name: string
  version: string | null
}

export interface XrayVuln {
  package: string
  version: string | null
  id: string
  summary: string
  link: string
}

export interface XrayParseError {
  file: string
  line: number
  detail: string
}

/** Сырой вывод Python-анализатора. */
export interface XrayRaw {
  language: string
  files_analyzed: number
  files_skipped: string[]
  parse_errors: XrayParseError[]
  facts: {
    internet: XrayFinding[]
    files: XrayFinding[]
    commands: XrayFinding[]
    secrets: XrayFinding[]
    suspicious: XrayFinding[]
  }
  addresses: {
    urls: string[]
    ips: string[]
    flags: XrayAddressFlag[]
  }
  dependencies: {
    ecosystem: string
    packages: XrayDependency[]
  }
}

/** Отчёт X-Ray = сырой анализ + уязвимости из OSV. */
export interface XrayReport extends XrayRaw {
  vulns: XrayVuln[]
  osvCheckedAt: string // ISO-дата проверки базы OSV
}

/** X-Ray-паспорт для карточки каталога — агрегаты без кода и номеров строк. */
export interface XrayPassport {
  analyzedFiles: number
  internet: { used: boolean; hosts: string[]; flags: { value: string; kind: XrayFlagKind }[] }
  writesFiles: boolean
  runsCommands: boolean
  secretsFound: boolean
  vulns: Array<{ package: string; version: string | null; id: string }>
  builtAt: string
}
