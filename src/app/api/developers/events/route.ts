import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { rateLimit } from "@/lib/ratelimit"
import { clientIp } from "@/lib/ip"
import { readJobJson, jobErrorResponse } from "@/lib/jobs/http"
import { metricsEnabled, recordExposure, seal, unseal } from "@/lib/developers/metrics"

const schema = z.object({ token: z.string().max(7000), ids: z.array(z.string().min(1).max(100)).min(1).max(20) }).strict()
const COOKIE = "cp_exposure"
const cookieValue = (req: Request, name: string) => req.headers.get("cookie")?.split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1)
function sameOrigin(req: Request) {
  const origin = req.headers.get("origin")
  if (!origin) return false
  // Next normalizes loopback IPs to localhost in Request.url; retain the actual
  // Host header for same-origin browser requests. The configured URL also covers
  // HTTPS termination at our reverse proxy. Forwarded client hosts are not used.
  const url = new URL(req.url), host = req.headers.get("host")
  try {
    return origin === url.origin || (host !== null && origin === new URL(`${url.protocol}//${host}`).origin)
      || (!!process.env.NEXT_PUBLIC_APP_URL && origin === new URL(process.env.NEXT_PUBLIC_APP_URL).origin)
  } catch { return false }
}
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return new Response(null, { status: 403 })
  const response = new NextResponse(null, { status: 204 }); response.cookies.set(COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" }); return response
}
export async function POST(req: Request) {
  const noStore = { "Cache-Control": "private, no-store" }
  if (!sameOrigin(req)) return new Response(null, { status: 403, headers: noStore })
  if (!metricsEnabled() || cookieValue(req, "cp_cookie_consent") !== "all") return new Response(null, { status: 204, headers: noStore })
  try {
    const body = schema.safeParse(await readJobJson(req))
    if (!body.success) return new Response(null, { status: 422, headers: noStore })
    const token = unseal(body.data.token), now = Date.now()
    if (!token || !["IMPRESSION", "PROFILE_OPEN"].includes(String(token.kind)) || typeof token.expires !== "number" || token.expires <= now || token.expires > now + 31 * 60000 || !Array.isArray(token.ids)) return new Response(null, { status: 422, headers: noStore })
    const permittedIds = token.ids
    if (body.data.ids.some(id => !permittedIds.includes(id))) return new Response(null, { status: 422, headers: noStore })
    const previous = unseal(cookieValue(req, COOKIE) ?? "")
    const validVisitor = previous && typeof previous.id === "string" && typeof previous.expires === "number" && previous.expires > now
    const visitor = validVisitor ? previous.id as string : randomUUID()
    // Only transient, keyed IP material is used for an additional process-local
    // abuse budget. Nothing from headers is written to analytics rows or logs.
    const ipKey = seal({ ip: clientIp(req).slice(0, 100) || "unknown" })?.split(".")[1] ?? "unknown"
    if (!rateLimit(`exposure:ip:${ipKey}`, 120, 60000) || !rateLimit(`exposure:visitor:${visitor}`, 60, 60000)) return new Response(null, { status: 429, headers: noStore })
    await recordExposure(token.kind as "IMPRESSION" | "PROFILE_OPEN", body.data.ids, visitor)
    const response = new NextResponse(null, { status: 204, headers: noStore })
    if (!validVisitor) response.cookies.set(COOKIE, seal({ id: visitor, expires: now + 86400000 })!, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 86400 })
    return response
  } catch (error) { return jobErrorResponse(error) }
}
