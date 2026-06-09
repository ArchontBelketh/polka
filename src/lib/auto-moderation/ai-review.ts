import { callAi } from "@/lib/ai-review/provider"
import { db } from "@/lib/db"

export interface ContentFlags {
  mismatch: boolean
  suspicious: boolean
  aiConfidence: number
  reasons: string[]
  provider: "gemini" | "ollama" | "yandexgpt" | "skipped"
}

const SKIP: ContentFlags = {
  mismatch: false,
  suspicious: false,
  aiConfidence: 0,
  reasons: [],
  provider: "skipped",
}

function resolvedProvider(): ContentFlags["provider"] {
  const p = process.env.AI_REVIEW_PROVIDER ?? "disabled"
  if (p === "gemini" || p === "ollama" || p === "yandexgpt") return p
  return "skipped"
}

export async function reviewProductContent(productId: string): Promise<ContentFlags> {
  const provider = resolvedProvider()
  if (provider === "skipped") return SKIP

  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      title: true,
      shortDesc: true,
      category: true,
      techStack: true,
      files: { select: { fileName: true, fileSize: true, format: true } },
    },
  })
  if (!product) return SKIP

  const fileInfo =
    product.files.map((f) => `${f.fileName} (${f.format}, ${(f.fileSize / 1024).toFixed(0)} КБ)`).join(", ") ||
    "нет файлов"

  const prompt = `Ты — автоматический модератор маркетплейса программных инструментов.
Продукт: "${product.title}"
Категория: ${product.category}
Описание: ${product.shortDesc}
Файлы: ${fileInfo}
Техстек: ${product.techStack.join(", ") || "не указан"}

Ответь на два вопроса:
1. Есть ли явное несоответствие между описанием и типом загруженного файла?
2. Описание выглядит как спам, бессмыслица или явная дезинформация?

Ответь строго в JSON без пояснений: {"mismatch": boolean, "suspicious": boolean, "reason": "краткое объяснение на русском, до 100 символов"}`

  const raw = await callAi(prompt)
  if (!raw) return { ...SKIP, provider }

  try {
    const match = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match ? match[0] : raw) as {
      mismatch?: unknown
      suspicious?: unknown
      reason?: unknown
    }
    const mismatch = parsed.mismatch === true
    const suspicious = parsed.suspicious === true
    const reason = typeof parsed.reason === "string" ? parsed.reason : ""
    return {
      mismatch,
      suspicious,
      aiConfidence: 0.8,
      reasons: reason && (mismatch || suspicious) ? [reason] : [],
      provider,
    }
  } catch {
    return { ...SKIP, provider }
  }
}

export async function reviewVersionChangelog(
  versionId: string,
): Promise<{ valid: boolean; reason?: string }> {
  if (resolvedProvider() === "skipped") return { valid: true }

  const version = await db.productVersion.findUnique({
    where: { id: versionId },
    select: { version: true, changelog: true, product: { select: { title: true } } },
  })
  if (!version?.changelog) return { valid: true }

  const prompt = `Это changelog версии ${version.version} продукта "${version.product.title}".
Текст: ${version.changelog}

Выглядит ли это как настоящий список изменений программного продукта, или это спам/мусор/бессвязный текст?
Ответь строго в JSON: {"valid": boolean, "reason": "краткое объяснение на русском, до 80 символов"}`

  const raw = await callAi(prompt)
  if (!raw) return { valid: true }

  try {
    const match = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match ? match[0] : raw) as { valid?: unknown; reason?: unknown }
    return {
      valid: parsed.valid !== false,
      reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    }
  } catch {
    return { valid: true }
  }
}
