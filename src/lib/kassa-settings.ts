import { cache } from "react"
import { db } from "@/lib/db"
import { getOperatorInfo } from "@/lib/operator"

export interface KassaSettings {
  enabled: boolean
  publicId: string | null
  apiSecret: string | null
  inn: string | null // ИНН оператора — из OperatorSettings
}

/**
 * Настройки кассы (singleton) + ИНН оператора. try/catch — на случай, если
 * таблицы ещё нет (до db push). cache() дедуплицирует запрос в рамках рендера.
 */
export const getKassaSettings = cache(async (): Promise<KassaSettings> => {
  let enabled = false
  let publicId: string | null = null
  let apiSecret: string | null = null
  try {
    const row = await db.kassaSettings.findUnique({ where: { id: "singleton" } })
    if (row) {
      enabled = row.enabled
      publicId = row.publicId
      apiSecret = row.apiSecret
    }
  } catch {
    // таблицы ещё нет
  }
  const op = await getOperatorInfo()
  return { enabled, publicId, apiSecret, inn: op.inn }
})

/** Касса готова бить чеки: включена и есть Public ID, секрет и ИНН оператора. */
export function isKassaReady(s: KassaSettings): boolean {
  return s.enabled && !!s.publicId && !!s.apiSecret && !!s.inn
}
