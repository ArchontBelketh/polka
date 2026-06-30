/**
 * Получение «сигнала» по IP: VPN/прокси + ASN + страна.
 * Источник — внешний API репутации (proxycheck.io / vpnapi.io), один запрос
 * закрывает все три проверки. Результат кэшируется по IP.
 *
 * Здесь же — точка расширения для оффлайн-бэкенда (MaxMind GeoLite2): если в
 * будущем понадобится работать без внешних запросов, добавляется чтение .mmdb
 * и заполняются asn/country локально (см. README модуля).
 */
import { guardConfig } from "./config"
import { getCached, setCached } from "./cache"

export interface IpSignal {
  vpn: boolean
  proxy: boolean
  asn?: number
  country?: string // ISO-код страны, верхний регистр
  provider?: string
}

const TIMEOUT_MS = 4000

function parseAsn(raw: unknown): number | undefined {
  if (raw == null) return undefined
  const n = Number(String(raw).replace(/^AS/i, ""))
  return isNaN(n) ? undefined : n
}

async function fetchProxycheck(ip: string): Promise<IpSignal> {
  const key = guardConfig.api.key ? `&key=${guardConfig.api.key}` : ""
  const url = `https://proxycheck.io/v2/${ip}?vpn=1&asn=1${key}`
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  const data = (await res.json()) as Record<string, { proxy?: string; type?: string; isocode?: string; asn?: string; provider?: string }>
  const node = data[ip] ?? {}
  const isProxy = node.proxy === "yes"
  return {
    proxy: isProxy,
    vpn: isProxy || node.type === "VPN",
    asn: parseAsn(node.asn),
    country: node.isocode?.toUpperCase(),
    provider: node.provider,
  }
}

async function fetchVpnapi(ip: string): Promise<IpSignal> {
  const url = `https://vpnapi.io/api/${ip}?key=${guardConfig.api.key}`
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  const data = (await res.json()) as {
    security?: { vpn?: boolean; proxy?: boolean; tor?: boolean; relay?: boolean }
    location?: { country_code?: string }
    network?: { autonomous_system_number?: string; autonomous_system_organization?: string }
  }
  const sec = data.security ?? {}
  return {
    proxy: Boolean(sec.proxy || sec.tor || sec.relay),
    vpn: Boolean(sec.vpn || sec.proxy || sec.tor || sec.relay),
    asn: parseAsn(data.network?.autonomous_system_number),
    country: data.location?.country_code?.toUpperCase(),
    provider: data.network?.autonomous_system_organization,
  }
}

/** Сигнал по IP с кэшем. Бросает исключение при сетевой ошибке/таймауте. */
export async function lookupSignal(ip: string): Promise<IpSignal> {
  const cached = getCached(ip)
  if (cached) return cached

  const signal =
    guardConfig.api.provider === "vpnapi" ? await fetchVpnapi(ip) : await fetchProxycheck(ip)

  setCached(ip, signal, guardConfig.cacheTtlMs)
  return signal
}
