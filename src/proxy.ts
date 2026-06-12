import { NextRequest, NextResponse } from "next/server"
import { limits } from "@/lib/ratelimit"
import { clientIp } from "@/lib/ip"

const AUTH_REQUIRED = ["/dashboard", "/submit", "/purchases"]
const MOD_REQUIRED  = ["/admin"]

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  // Trusted source (X-Real-IP); never the spoofable first X-Forwarded-For entry
  const ip = clientIp(req) || "anonymous"

  // ── Auth guard ─────────────────────────────────────────────────────────
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
    // Role check for /admin done inside the page via auth() (optimistic check here)
  }

  // ── Rate limiting ──────────────────────────────────────────────────────
  // Payment creation is rate-limited inside its route handler by userId
  // (from the session) — keeping an IP-keyed copy here would be a second,
  // inconsistent bucket, so it is intentionally omitted.
  const rateLimitedRoutes: Array<{ prefix: string; check: () => boolean }> = [
    { prefix: "/api/upload",           check: () => limits.upload(ip) },
    { prefix: "/api/scan",             check: () => limits.scan(ip) },
    { prefix: "/api/reviews",          check: () => limits.reviews(ip) },
    { prefix: "/api/coupons/validate", check: () => limits.coupon(ip) },
  ]

  for (const route of rateLimitedRoutes) {
    if (pathname.startsWith(route.prefix) && !route.check()) {
      return Response.json(
        { error: "Слишком много запросов. Попробуйте позже." },
        { status: 429, headers: { "Retry-After": "60" } }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
}
