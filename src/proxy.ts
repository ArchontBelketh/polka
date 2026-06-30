import { NextRequest, NextResponse } from "next/server"
import { limits } from "@/lib/ratelimit"
import { clientIp } from "@/lib/ip"
import { guardConfig, checkAccess } from "@/lib/access-guard"

const AUTH_REQUIRED = ["/dashboard", "/submit", "/purchases"]
const MOD_REQUIRED  = ["/admin"]

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── Maintenance mode ─────────────────────────────────────────────────────
  // Toggle with MAINTENANCE_MODE=1 (requires restart). Everything is served the
  // maintenance page except the page itself and the health probe (so uptime
  // monitoring still works). API calls get a 503 JSON instead of HTML.
  const maintenance =
    process.env.MAINTENANCE_MODE === "1" || process.env.MAINTENANCE_MODE === "true"
  if (maintenance && pathname !== "/maintenance" && pathname !== "/api/health") {
    if (pathname.startsWith("/api/")) {
      return Response.json(
        { error: "Сервис на техническом обслуживании" },
        { status: 503, headers: { "Retry-After": "3600" } },
      )
    }
    const url = req.nextUrl.clone()
    url.pathname = "/maintenance"
    const res = NextResponse.rewrite(url)
    res.headers.set("Retry-After", "3600")
    return res
  }

  // Trusted source (X-Real-IP); never the spoofable first X-Forwarded-For entry
  const ip = clientIp(req) || "anonymous"

  // ── Access guard (анти-VPN / прокси / дата-центр / гео) ───────────────────
  // Главный рубильник — ACCESS_GUARD_ENABLED. Пока выключен, checkAccess
  // мгновенно возвращает allowed:true (никаких запросов). Страница /blocked и
  // health-проба не проверяются, чтобы не было петли и работал мониторинг.
  if (guardConfig.enabled && pathname !== "/blocked" && pathname !== "/api/health") {
    const access = await checkAccess(ip)
    if (!access.allowed) {
      if (pathname.startsWith("/api/")) {
        return Response.json(
          { error: "Доступ ограничен. Похоже, вы используете VPN/прокси." },
          { status: 403 },
        )
      }
      const url = req.nextUrl.clone()
      url.pathname = "/blocked"
      url.searchParams.set("reason", access.reason ?? "vpn")
      return NextResponse.rewrite(url)
    }
  }

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
