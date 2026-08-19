/**
 * Приложение №1 к оферте — стоимостные показатели гибридной модели.
 * Единый источник значений: цены в БД хранятся в копейках, поэтому пороги
 * задаются в рублях (env) и здесь же переводятся в копейки.
 *
 * Env (все опциональны, дефолты соответствуют Приложению №1):
 *   PRICE_THRESHOLD_RUB        — ценовой порог (дефолт 15000)
 *   COMMISSION_RATE            — комиссия по «Комиссии» (дефолт 0.20)
 *   COMMISSION_RATE_PRO        — комиссия для Pro (дефолт 0.17)
 *   PAYOUT_HOLD_THRESHOLD_RUB  — порог удержания выплаты (дефолт 3000)
 *   LISTING_FEE_RATE           — тариф за размещение (дефолт 0.08)
 */

const KOPECKS_IN_RUB = 100

function envNum(key: string, fallback: number): number {
  const v = parseFloat(process.env[key] ?? "")
  return Number.isFinite(v) ? v : fallback
}

// Ценовой порог: < порога → «Комиссия», ≥ порога → «Тариф за размещение».
export const PRICE_THRESHOLD_RUB = envNum("PRICE_THRESHOLD_RUB", 15000)
export const priceThresholdKopecks = Math.round(PRICE_THRESHOLD_RUB * KOPECKS_IN_RUB)

// Вознаграждение оператора по «Комиссии».
export const COMMISSION_RATE = envNum("COMMISSION_RATE", 0.2)
export const COMMISSION_RATE_PRO = envNum("COMMISSION_RATE_PRO", 0.17)
export function commissionRate(isPro: boolean): number {
  return isPro ? COMMISSION_RATE_PRO : COMMISSION_RATE
}

// Порог удержания выплаты (п. 8.5): для продаж ≥ этого порога выплата
// придерживается до конца окна претензии.
export const PAYOUT_HOLD_THRESHOLD_RUB = envNum("PAYOUT_HOLD_THRESHOLD_RUB", 3000)
export const payoutHoldThresholdKopecks = Math.round(PAYOUT_HOLD_THRESHOLD_RUB * KOPECKS_IN_RUB)

// Тариф за размещение — единоразовая плата разработчика (доля от цены продукта).
export const LISTING_FEE_RATE = envNum("LISTING_FEE_RATE", 0.08)

/** Проценты для отображения (20, 17, 8). */
export const COMMISSION_PCT = Math.round(COMMISSION_RATE * 100)
export const COMMISSION_PCT_PRO = Math.round(COMMISSION_RATE_PRO * 100)
export const LISTING_FEE_PCT = Math.round(LISTING_FEE_RATE * 100)

/** Форматирование суммы в рублях (для страниц/подсказок). */
export function formatRub(rub: number): string {
  return `${rub.toLocaleString("ru-RU")} ₽`
}

// ── Модель продажи по ценовому порогу ────────────────────────────────────────
export type SaleModel = "COMMISSION" | "LISTING_FEE"

/** Модель по цене в копейках (как хранится в БД). */
export function saleModelForKopecks(kopecks: number): SaleModel {
  return kopecks >= priceThresholdKopecks ? "LISTING_FEE" : "COMMISSION"
}

/** Модель по цене в рублях (для форм). */
export function saleModelForRub(rub: number): SaleModel {
  return rub >= PRICE_THRESHOLD_RUB ? "LISTING_FEE" : "COMMISSION"
}

export const SALE_MODEL_LABELS: Record<SaleModel, string> = {
  COMMISSION: "Комиссия",
  LISTING_FEE: "Тариф за размещение",
}

/** Единоразовый тариф за размещение в копейках (доля от цены продукта). */
export function listingFeeKopecks(priceKopecks: number): number {
  return Math.round(priceKopecks * LISTING_FEE_RATE)
}

