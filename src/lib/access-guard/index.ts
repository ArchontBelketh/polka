/**
 * access-guard — единая точка проверки доступа (анти-VPN / прокси / дата-центр / гео).
 *
 * Использование:
 *   const { allowed, reason } = await checkAccess(ip)
 *
 * Главный рубильник — ACCESS_GUARD_ENABLED. Пока выключен, checkAccess мгновенно
 * возвращает allowed:true без каких-либо запросов.
 */
import { guardConfig, isAllowlisted } from "./config"
import { lookupSignal } from "./lookup"

export interface AccessResult {
  allowed: boolean
  /** Причина отказа: "vpn" | "datacenter" | "geo" (для логов/страницы). */
  reason?: "vpn" | "datacenter" | "geo"
}

// Встроенный список ASN хостингов/дата-центров и крупных VPN-сетей.
// Расширяется через ACCESS_GUARD_DENY_ASNS. Не исчерпывающий — антифрод-минимум.
const DEFAULT_DENY_ASNS = new Set<number>([
  16276, // OVH
  24940, // Hetzner
  14061, // DigitalOcean
  20473, // Vultr (Choopa)
  63949, // Akamai/Linode
  16509, // Amazon AWS
  14618, // Amazon AWS
  15169, // Google
  8075, // Microsoft Azure
  9009, // M247 (частый VPN-хостинг)
  60068, // Datacamp/CDN77 (VPN-инфраструктура)
  51852, // Private Layer (VPN)
  212238, // Datacamp
  206092, // IPXO / VPN
  62240, // Clouvider
  213035, // Cloudflare WARP-подобные? — при необходимости убрать
])

function denyAsns(): Set<number> {
  if (guardConfig.denyAsns.size === 0) return DEFAULT_DENY_ASNS
  // объединяем встроенный список с пользовательскими
  return new Set<number>([...DEFAULT_DENY_ASNS, ...guardConfig.denyAsns])
}

export async function checkAccess(ip: string): Promise<AccessResult> {
  const cfg = guardConfig

  // Рубильник выключен → ничего не делаем.
  if (!cfg.enabled) return { allowed: true }

  // Нет ни одной включённой проверки → пропускаем.
  if (!cfg.checks.vpnApi && !cfg.checks.asn && !cfg.checks.geo) return { allowed: true }

  // IP не определён (прямой локальный доступ и т.п.) → не блокируем.
  if (!ip || ip === "anonymous") return { allowed: true }

  // Белый список (свои офисы/партнёры).
  if (isAllowlisted(ip)) return { allowed: true }

  try {
    const sig = await lookupSignal(ip)

    // Вариант 1 — VPN/прокси по API.
    if (cfg.checks.vpnApi && (sig.vpn || sig.proxy)) {
      return { allowed: false, reason: "vpn" }
    }

    // Вариант 2 — дата-центровые/хостинговые ASN.
    if (cfg.checks.asn && sig.asn != null && denyAsns().has(sig.asn)) {
      return { allowed: false, reason: "datacenter" }
    }

    // Вариант 3 — гео (только разрешённые страны).
    if (
      cfg.checks.geo &&
      cfg.allowedCountries.size > 0 &&
      sig.country &&
      !cfg.allowedCountries.has(sig.country)
    ) {
      return { allowed: false, reason: "geo" }
    }

    return { allowed: true }
  } catch {
    // Ошибка/таймаут API → fail-open (по умолчанию пускаем, чтобы не запереть клиентов).
    return { allowed: cfg.failOpen }
  }
}

export { guardConfig } from "./config"
