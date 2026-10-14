import { callAi } from "./provider"
import { extractSnippets } from "./extract-snippets"
import type { XrayReport } from "@/lib/xray/types"

// AI-аудит произвольного кода (ТЗ 11.1). В отличие от старого ревью карточки
// товара, вход — прикреплённый код заказа + факты X-Ray. Нейросеть объясняет
// факты простым языком; оговорка «не гарантия» добавляется в UI, не в модель.

export interface CodeAuditResult {
  summary: string
  security: { score: number; summary: string; issues: string[] }
  quality: { score: number; summary: string; issues: string[] }
  xray_explained: string[]
  recommendations: string[]
  verdict: string
}

export async function runCodeAudit(params: {
  codeS3Key: string | null
  codeFileName: string | null
  brief: string | null
  xrayReport: XrayReport | null
}): Promise<CodeAuditResult | null> {
  const snippets = params.codeS3Key && params.codeFileName
    ? await extractSnippets(params.codeS3Key, params.codeFileName)
    : "(код не прикреплён)"

  const prompt = buildPrompt({
    snippets,
    brief: params.brief ?? "",
    xrayFacts: summarizeXray(params.xrayReport),
  })
  const raw = await callAi(prompt)
  if (!raw) return null
  return parseResult(raw)
}

// Факты X-Ray в компактный текст для подсказки нейросети.
function summarizeXray(report: XrayReport | null): string {
  if (!report) return "(X-Ray не проводился)"
  const f = report.facts
  const list = (items: { detail: string; file: string; line: number }[]) =>
    items.length ? items.map((i) => `${i.detail} (${i.file}:${i.line})`).join("; ") : "нет"
  const addrs = [...report.addresses.urls, ...report.addresses.ips]
  const flags = report.addresses.flags.map((fl) => `${fl.kind}:${fl.value}`)
  const vulns = report.vulns.map((v) => `${v.package}${v.version ? " " + v.version : ""} — ${v.id}: ${v.summary}`)
  return [
    `Файлов проанализировано: ${report.files_analyzed}`,
    `Выход в интернет: ${list(f.internet)}`,
    `Адреса: ${addrs.length ? addrs.join(", ") : "нет"}`,
    flags.length ? `Подозрительные адреса: ${flags.join(", ")}` : "",
    `Работа с файлами: ${list(f.files)}`,
    `Запуск команд: ${list(f.commands)}`,
    `Секреты в коде: ${list(f.secrets)}`,
    `Подозрительное: ${list(f.suspicious)}`,
    `Уязвимые зависимости: ${vulns.length ? vulns.join("; ") : "нет"}`,
  ].filter(Boolean).join("\n")
}

function buildPrompt(params: { snippets: string; brief: string; xrayFacts: string }): string {
  return `Ты — опытный аудитор безопасности и качества кода. Пишешь простым русским языком для не-программиста.
Проанализируй код с учётом фактов автоматического анализатора X-Ray. Объясни факты X-Ray человеческим языком.
Верни ТОЛЬКО валидный JSON без лишнего текста и без markdown.

Запрос заказчика: ${params.brief || "(не указан)"}

Факты X-Ray:
${params.xrayFacts}

Фрагменты кода:
${params.snippets}

Верни JSON строго по схеме:
{
  "summary": "<2-4 предложения: что этот код делает, простым языком>",
  "security":  { "score": <1-10>, "summary": "<строка>", "issues": ["<проблема>"] },
  "quality":   { "score": <1-10>, "summary": "<строка>", "issues": ["<проблема>"] },
  "xray_explained": ["<объяснение каждого значимого факта X-Ray простым языком>"],
  "recommendations": ["<что сделать>"],
  "verdict": "<1-2 предложения итогового заключения>"
}`
}

function parseResult(raw: string): CodeAuditResult | null {
  try {
    const clean = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim()
    const parsed = JSON.parse(clean) as CodeAuditResult
    if (typeof parsed.summary !== "string" || !parsed.security || !parsed.quality) return null
    return parsed
  } catch {
    return null
  }
}
