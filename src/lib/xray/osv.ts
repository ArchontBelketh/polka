import type { XrayDependency, XrayVuln } from "./types"

// Проверка зависимостей по базе OSV (osv.dev) через публичный HTTP-API.
// Источник данных: OSV (указание источника обязательно — выводится в отчёте).
const OSV_BATCH = "https://api.osv.dev/v1/querybatch"
const OSV_VULN = "https://api.osv.dev/v1/vulns/"
const MAX_VULN_DETAILS = 20

interface BatchResult {
  results?: Array<{ vulns?: Array<{ id: string }> }>
}

/**
 * Возвращает список известных уязвимостей для пакетов с указанной версией.
 * Проверяются только пакеты PyPI с точной версией. Сетевые сбои не роняют
 * анализ — возвращаем пустой список.
 */
export async function checkOsv(packages: XrayDependency[]): Promise<XrayVuln[]> {
  const withVersion = packages.filter((p) => p.name && p.version)
  if (withVersion.length === 0) return []

  const queries = withVersion.map((p) => ({
    package: { name: p.name, ecosystem: "PyPI" },
    version: p.version,
  }))

  let batch: BatchResult
  try {
    const res = await fetch(OSV_BATCH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queries }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return []
    batch = (await res.json()) as BatchResult
  } catch {
    return []
  }

  // Собираем (пакет, версия, id) и уникальные id для подтягивания описаний.
  const hits: Array<{ pkg: XrayDependency; id: string }> = []
  const results = batch.results ?? []
  for (let i = 0; i < withVersion.length; i++) {
    for (const v of results[i]?.vulns ?? []) {
      hits.push({ pkg: withVersion[i], id: v.id })
    }
  }
  if (hits.length === 0) return []

  // Описания для первых N уникальных уязвимостей (best-effort).
  const uniqueIds = [...new Set(hits.map((h) => h.id))].slice(0, MAX_VULN_DETAILS)
  const summaries = new Map<string, string>()
  await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const r = await fetch(OSV_VULN + id, { signal: AbortSignal.timeout(8_000) })
        if (!r.ok) return
        const d = (await r.json()) as { summary?: string; details?: string }
        summaries.set(id, d.summary || (d.details ? d.details.slice(0, 200) : ""))
      } catch {
        /* ignore */
      }
    }),
  )

  return hits.map((h) => ({
    package: h.pkg.name,
    version: h.pkg.version,
    id: h.id,
    summary: summaries.get(h.id) ?? "",
    link: `https://osv.dev/vulnerability/${h.id}`,
  }))
}
