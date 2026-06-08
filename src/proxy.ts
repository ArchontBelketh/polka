import { NextRequest, NextResponse } from "next/server"

// In-memory rate limiter (per-process, resets on restart)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

const RATE_LIMITS: Record<string, { window: number; limit: number }> = {
  "/api/upload": { window: 60_000, limit: 20 },
  "/api/scan":   { window: 60_000, limit: 5 },
}

const AUTH_REQUIRED = ["/dashboard", "/submit"]
const MOD_REQUIRED  = ["/admin"]

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // --- Auth guard ---
  const needsAuth = AUTH_REQUIRED.some((p) => pathname.startsWith(p))
  const needsMod  = MOD_REQUIRED.some((p) => pathname.startsWith(p))

  if (needsAuth || needsMod) {
    const sessionCookie =
      req.cookies.get("authjs.session-token") ??
      req.cookies.get("__Secure-authjs.session-token")

    if (!sessionCookie) {
      const loginUrl = new URL("/login", req.url)
      loginUrl.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(loginUrl)
    }

    // For /admin pages: role check is done inside the page via auth()
    // Proxy only verifies the cookie exists; this is an optimistic check
    // (prevents unauthenticated users but not role bypass — pages re-verify)
  }

  // --- Rate limiting ---
  const rlKey = Object.keys(RATE_LIMITS).find((k) => pathname.startsWith(k))
  if (rlKey) {
    const { window, limit } = RATE_LIMITS[rlKey]
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous"
    const key = `${ip}:${rlKey}`
    const now = Date.now()

    const entry = rateLimitStore.get(key)
    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + window })
    } else if (entry.count >= limit) {
      return Response.json(
        { error: "Слишком много запросов. Попробуйте позже." },
        { status: 429, headers: { "Retry-After": "60" } },
      )
    } else {
      entry.count++
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
}
