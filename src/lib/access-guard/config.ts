/**
 * Конфигурация модуля access-guard (анти-VPN / прокси / гео).
 * Главный рубильник — ACCESS_GUARD_ENABLED. Пока он выключен, проверки не
 * выполняются вообще (нулевые накладные расходы).
 */
import { ipInCidr } from "@/lib/ip"

const bool = (v?: string) => v === "1" || v === "true"
const list = (v?: string) =>
  (v ?? "").split(",").map((s) => s.trim()).filter(Boolean)

export const guardConfig = {
  /** Главный рубильник: выключает весь модуль одним движением. */
  enabled: bool(process.env.ACCESS_GUARD_ENABLED),

  /** Независимые проверки — каждую можно включать отдельно. */
  checks: {
    vpnApi: bool(process.env.ACCESS_GUARD_VPN_API), // вариант 1: VPN/прокси по API
    asn: bool(process.env.ACCESS_GUARD_ASN), // вариант 2: дата-центровые ASN
    geo: bool(process.env.ACCESS_GUARD_GEO), // вариант 3: разрешённые страны
  },

  api: {
    provider: (process.env.ACCESS_GUARD_API_PROVIDER ?? "proxycheck") as "proxycheck" | "vpnapi",
    key: process.env.ACCESS_GUARD_API_KEY ?? "",
  },

  /** Для GEO: разрешённые страны (ISO, например RU). Пусто = гео-проверка ничего не режет. */
  allowedCountries: new Set(list(process.env.ACCESS_GUARD_ALLOWED_COUNTRIES).map((c) => c.toUpperCase())),

  /** Доп. ASN для блокировки (к встроенному списку дата-центров). Числа без "AS". */
  denyAsns: new Set(list(process.env.ACCESS_GUARD_DENY_ASNS).map((n) => Number(n)).filter((n) => !isNaN(n))),

  /** IP/CIDR в обход всех проверок (свои офисы, партнёры). */
  allowlist: list(process.env.ACCESS_GUARD_ALLOWLIST),

  /** Кэш вердиктов по IP, мс (по умолчанию час) — экономит лимиты API и латентность. */
  cacheTtlMs: Number(process.env.ACCESS_GUARD_CACHE_TTL_MS ?? 3_600_000),

  /** При ошибке/таймауте API: пускать (fail-open, по умолчанию) — чтобы не запереть клиентов. */
  failOpen: process.env.ACCESS_GUARD_FAIL_OPEN !== "0",
}

/** IP в обходном списке? (точное совпадение или попадание в CIDR) */
export function isAllowlisted(ip: string): boolean {
  return guardConfig.allowlist.some((entry) =>
    entry.includes("/") ? ipInCidr(ip, entry) : entry === ip,
  )
}
