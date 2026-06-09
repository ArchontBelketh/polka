import fs from "fs"
import path from "path"
import type { ScanFinding } from "@/types"

// Extended network indicators not covered by the base patterns.ts
// Targets: tunnel services (C2), dynamic DNS, Base64-encoded URLs

const TEXT_EXTS = new Set([".py", ".js", ".ts", ".jsx", ".tsx", ".bsl", ".vbs", ".ps1", ".bat", ".sh", ".rb"])

// Tunnel / reverse-proxy services commonly used for C2
const TUNNEL_RE =
  /\b(?:[\w-]+\.)?(?:ngrok\.io|ngrok\.app|ngrok\.dev|loca\.lt|localhost\.run|localtunnel\.me|serveo\.net|bore\.pub|telebit\.cloud|expose\.dev)\b/i

// Dynamic DNS providers — legitimate tools rarely hardcode these
const DDNS_RE =
  /\b[\w-]+\.(?:dyndns\.(?:org|info|biz)|no-ip\.(?:com|biz|info|org|net)|ddns\.net|myftp\.(?:org|biz)|zapto\.org|hopto\.org|sytes\.net|redirectme\.net|changeip\.com|3utilities\.com|bounceme\.net|freedns\.afraid\.org)\b/i

// Base64 prefix of "http://" = "aHR0cDov" and "https://" = "aHR0cHM6"
// Detect encoded URLs in source code (common evasion for static analysis)
const BASE64_URL_RE = /(?:aHR0cHM6|aHR0cDov)[\w+/]{8,}={0,2}/

interface LineCheck {
  re: RegExp
  message: string
}

const LINE_CHECKS: LineCheck[] = [
  { re: TUNNEL_RE, message: "Домен туннельного сервиса (ngrok / loca.lt) — возможный C2-адрес" },
  { re: DDNS_RE, message: "Динамический DNS-домен — нетипично для легальных инструментов" },
  { re: BASE64_URL_RE, message: "Base64-закодированный URL в коде — возможный скрытый сетевой адрес" },
]

export function checkNetworkExtra(filePath: string): ScanFinding[] {
  const ext = path.extname(filePath).toLowerCase()
  if (!TEXT_EXTS.has(ext)) return []

  let content: string
  try {
    content = fs.readFileSync(filePath, "utf8")
  } catch {
    return []
  }

  const findings: ScanFinding[] = []
  const fileName = path.basename(filePath)
  const lines = content.split("\n")

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const check of LINE_CHECKS) {
      if (check.re.test(line)) {
        findings.push({
          tool: "network-extra",
          severity: "warning",
          message: check.message,
          file: fileName,
          line: i + 1,
        })
        break // one finding per line is enough
      }
    }
  }

  return findings
}
