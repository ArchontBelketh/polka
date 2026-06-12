/**
 * IPv4 CIDR matching and trusted client-IP extraction.
 *
 * IPv6 is intentionally unsupported: the YooKassa webhook domain must not
 * publish an AAAA record, so notifications always arrive over IPv4. An IPv6
 * source will fail the allowlist (return false) rather than be wrongly trusted.
 */

function isValidIpv4(ip: string): boolean {
  const parts = ip.split(".")
  if (parts.length !== 4) return false
  return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)
}

function ipToLong(ip: string): number {
  return ip.split(".").reduce((acc, oct) => ((acc << 8) + Number(oct)) >>> 0, 0) >>> 0
}

/** True if IPv4 `ip` falls inside `cidr` (e.g. "185.71.76.0/27"). */
export function ipInCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/")
  const bits = Number(bitsStr ?? "32")
  if (!isValidIpv4(ip) || !isValidIpv4(range) || isNaN(bits) || bits < 0 || bits > 32) {
    return false
  }
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (ipToLong(ip) & mask) === (ipToLong(range) & mask)
}

/**
 * Trusted client IP behind a reverse proxy.
 *
 * nginx must set `X-Real-IP $remote_addr`. We prefer that; otherwise we take
 * the LAST entry of `X-Forwarded-For` (the one our own proxy appends), never
 * the first — the first entry is supplied by the client and is spoofable.
 * Returns "" when no trusted source is present (e.g. direct local access).
 */
export function clientIp(req: { headers: { get(name: string): string | null } }): string {
  const real = req.headers.get("x-real-ip")?.trim()
  if (real) return real
  const xff = req.headers.get("x-forwarded-for")
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean)
    if (parts.length) return parts[parts.length - 1]
  }
  return ""
}
