import { cache } from "react"
import { db } from "@/lib/db"
import { coerceProvider, DEFAULT_MODEL, type AiProvider } from "@/lib/ai-provider"

export type { AiProvider }
export { AI_PROVIDER_LABELS } from "@/lib/ai-provider"

export interface AiSettings {
  provider: AiProvider
  apiKey: string | null
  model: string | null
  folderId: string | null
}

/**
 * Настройки ИИ из админки (singleton). Если таблицы/строки ещё нет — откатываемся
 * на env (обратная совместимость). cache() дедуплицирует запрос в рамках рендера.
 */
export const getAiSettings = cache(async (): Promise<AiSettings> => {
  try {
    const row = await db.aiSettings.findUnique({ where: { id: "singleton" } })
    if (row) {
      return {
        provider: coerceProvider(row.provider),
        apiKey: row.apiKey,
        model: row.model,
        folderId: row.folderId,
      }
    }
  } catch {
    // таблицы ещё нет (до db push) — уходим в env
  }
  return {
    provider: coerceProvider(process.env.AI_REVIEW_PROVIDER),
    apiKey: process.env.GEMINI_API_KEY ?? process.env.YANDEX_GPT_API_KEY ?? null,
    model: null,
    folderId: process.env.YANDEX_FOLDER_ID ?? null,
  }
})

/** Услуга ИИ-ревью доступна: выбран провайдер и есть всё необходимое (ключ, folderId). */
export function isAiReviewEnabled(s: AiSettings): boolean {
  if (s.provider === "gemini") return !!s.apiKey
  if (s.provider === "yandexgpt") return !!s.apiKey && !!s.folderId
  return false
}

/** Модель для запроса (заданная в админке или дефолт провайдера). */
export function aiModel(s: AiSettings): string {
  return s.model?.trim() || DEFAULT_MODEL[s.provider] || ""
}
