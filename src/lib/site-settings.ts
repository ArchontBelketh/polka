import { cache } from "react"
import { db } from "@/lib/db"

export interface SiteSettings {
  relaySlaEnabled: boolean
  relaySlaDays: number
}

const DEFAULTS: SiteSettings = { relaySlaEnabled: false, relaySlaDays: 7 }

/**
 * Настройки сайта (синглтон). Если строки/таблицы ещё нет — дефолты.
 * cache() дедуплицирует запрос в рамках рендера.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const row = await db.siteSetting.findUnique({ where: { id: "singleton" } })
    if (row) return { relaySlaEnabled: row.relaySlaEnabled, relaySlaDays: row.relaySlaDays }
  } catch {
    // таблицы ещё нет (до db push) — дефолты
  }
  return DEFAULTS
})
