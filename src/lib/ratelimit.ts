interface Bucket {
  count: number
  resetAt: number
}

// Module-level map persists across requests in the same Node.js process.
// For multi-instance deployments, replace with Redis (e.g. @upstash/ratelimit).
const store = new Map<string, Bucket>()

// Clean stale entries every 10 minutes to prevent unbounded memory growth.
setInterval(
  () => {
    const now = Date.now()
    for (const [key, bucket] of store) {
      if (now > bucket.resetAt) store.delete(key)
    }
  },
  10 * 60 * 1000
)

/**
 * Returns true if the request is allowed, false if rate-limited.
 * @param key     Unique identifier, e.g. `upload:${ip}` or `payment:${userId}`
 * @param limit   Max requests per window
 * @param windowMs Window size in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = store.get(key)

  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (bucket.count >= limit) return false
  bucket.count++
  return true
}

// Pre-configured limiters for common routes
export const limits = {
  upload: (ip: string) => rateLimit(`upload:${ip}`, 20, 60_000),         // 20/min
  scan: (ip: string) => rateLimit(`scan:${ip}`, 5, 60_000),              // 5/min
  payment: (userId: string) => rateLimit(`pay:${userId}`, 10, 60_000),   // 10/min
  reviews: (userId: string) => rateLimit(`review:${userId}`, 10, 60_000), // 10/min
  coupon: (ip: string) => rateLimit(`coupon:${ip}`, 30, 60_000),         // 30/min
  questions: (userId: string) => rateLimit(`question:${userId}`, 5, 3_600_000), // 5/hour
  messages: (userId: string) => rateLimit(`msg:${userId}`, 20, 600_000),         // 20/10min
} as const
