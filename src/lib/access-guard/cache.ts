/** Простой in-memory TTL-кэш вердиктов по IP (на инстанс). */
import type { IpSignal } from "./lookup"

interface Entry {
  value: IpSignal
  expiresAt: number
}

const cache = new Map<string, Entry>()
const MAX_ENTRIES = 10_000

export function getCached(ip: string): IpSignal | null {
  const e = cache.get(ip)
  if (!e) return null
  if (Date.now() > e.expiresAt) {
    cache.delete(ip)
    return null
  }
  return e.value
}

export function setCached(ip: string, value: IpSignal, ttlMs: number): void {
  if (cache.size >= MAX_ENTRIES) {
    // грубая очистка: удалить самый старый ключ
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
  }
  cache.set(ip, { value, expiresAt: Date.now() + ttlMs })
}
