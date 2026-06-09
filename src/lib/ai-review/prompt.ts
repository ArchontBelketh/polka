import { callAi } from "./provider"
import { extractSnippets } from "./extract-snippets"
import { db } from "@/lib/db"

export interface AiReviewResult {
  overall_score: number
  quality:      { score: number; summary: string; issues: string[] }
  security:     { score: number; summary: string; issues: string[] }
  accuracy:     { score: number; summary: string; missing: string[] }
  installation: { score: number; complexity: "EASY" | "MEDIUM" | "HARD"; requirements: string[] }
  docs:         { score: number; summary: string }
  hidden_costs: string[]
  recommended_for: string[]
  verdict: string
}

export async function runAiReview(productId: string): Promise<AiReviewResult | null> {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      files: { take: 1 },
      scanResult: { select: { findings: true } },
    },
  })
  if (!product) return null

  const file = product.files[0]
  const snippets = file
    ? await extractSnippets(file.s3Key, file.fileName)
    : "(исходный файл недоступен)"

  const scanFindings = product.scanResult?.findings ?? []

  const prompt = buildPrompt({ product, snippets, scanFindings })
  const raw = await callAi(prompt)
  if (!raw) return null

  return parseResult(raw)
}

function buildPrompt(params: {
  product: { title: string; category: string; fullDesc: string; features: string[]; techStack: string[] }
  snippets: string
  scanFindings: unknown
}): string {
  const { product, snippets, scanFindings } = params
  return `Ты — опытный технический аудитор программного обеспечения.
Проанализируй следующий продукт и верни ТОЛЬКО валидный JSON без лишнего текста.

Название: ${product.title}
Категория: ${product.category}
Описание разработчика: ${product.fullDesc}
Заявленные функции: ${product.features.join(", ")}
Стек: ${product.techStack.join(", ") || "не указан"}
Результаты автосканирования безопасности: ${JSON.stringify(scanFindings)}
Фрагменты кода:
${snippets}

Верни JSON строго по этой схеме:
{
  "overall_score": <число 1-10>,
  "quality":       { "score": <1-10>, "summary": "<строка>", "issues": ["..."] },
  "security":      { "score": <1-10>, "summary": "<строка>", "issues": ["..."] },
  "accuracy":      { "score": <1-10>, "summary": "<строка>", "missing": ["..."] },
  "installation":  { "score": <1-10>, "complexity": "EASY|MEDIUM|HARD", "requirements": ["..."] },
  "docs":          { "score": <1-10>, "summary": "<строка>" },
  "hidden_costs":  ["<строка>"],
  "recommended_for": ["<строка>"],
  "verdict":       "<1-2 предложения итогового заключения>"
}`
}

function parseResult(raw: string): AiReviewResult | null {
  try {
    // Strip markdown code fences if any
    const clean = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim()
    const parsed = JSON.parse(clean) as AiReviewResult
    // Basic validation
    if (typeof parsed.overall_score !== "number") return null
    return parsed
  } catch {
    return null
  }
}
