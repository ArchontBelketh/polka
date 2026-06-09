// VirusTotal v3 hash lookup — no file upload, hash-only check
// Free plan: 4 req/min, 500 req/day
// Configured via VIRUSTOTAL_API_KEY env var; skipped if absent

export interface VtResult {
  known: boolean
  detections: number
  verdict: "clean" | "suspicious" | "malicious" | "skipped"
  details?: string
}

const SKIP: VtResult = { known: false, detections: 0, verdict: "skipped" }

export async function checkFileHash(sha256: string, fileName: string): Promise<VtResult> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY
  if (!apiKey) return SKIP

  try {
    const res = await fetch(`https://www.virustotal.com/api/v3/files/${sha256}`, {
      headers: { "x-apikey": apiKey },
      signal: AbortSignal.timeout(8000),
    })

    // File not in VT database — not malicious, just unknown
    if (res.status === 404) return { known: false, detections: 0, verdict: "clean" }

    if (res.status === 429) {
      console.warn("[virustotal] rate limited")
      return { ...SKIP, details: "rate_limited" }
    }

    if (!res.ok) {
      console.error(`[virustotal] ${res.status} for ${fileName}: ${await res.text().catch(() => "")}`)
      return SKIP
    }

    const data = await res.json() as {
      data?: {
        attributes?: {
          last_analysis_stats?: { malicious: number; suspicious: number }
          meaningful_name?: string
        }
      }
    }

    const stats = data.data?.attributes?.last_analysis_stats
    if (!stats) return { known: true, detections: 0, verdict: "clean" }

    const malicious = stats.malicious ?? 0
    const suspicious = stats.suspicious ?? 0

    if (malicious >= 2) {
      return {
        known: true,
        detections: malicious,
        verdict: "malicious",
        details: `${malicious} AV-движков`,
      }
    }
    if (malicious === 1 || suspicious >= 3) {
      return {
        known: true,
        detections: malicious + suspicious,
        verdict: "suspicious",
        details: `${malicious + suspicious} подозрительных`,
      }
    }
    return { known: true, detections: 0, verdict: "clean" }
  } catch (err) {
    if ((err as Error)?.name === "TimeoutError") {
      console.warn("[virustotal] timeout for", fileName)
    } else {
      console.error("[virustotal] unexpected error for", fileName, err)
    }
    return SKIP
  }
}
