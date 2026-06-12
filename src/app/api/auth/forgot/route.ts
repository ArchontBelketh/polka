import { NextRequest } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import { db } from "@/lib/db"
import { limits } from "@/lib/ratelimit"
import { clientIp } from "@/lib/ip"
import { notifyPasswordReset } from "@/lib/notify"

const schema = z.object({ email: z.string().email() })

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
const TTL_MS = 60 * 60 * 1000 // 1 hour

// Always responds 200 (unless rate-limited) so the endpoint never reveals
// whether an email exists in the database.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)

  const ip = clientIp(req) || "anonymous"
  if (!limits.forgot(ip)) {
    return Response.json({ error: "Слишком много запросов. Попробуйте позже." }, { status: 429 })
  }

  // Invalid email → behave the same (200) without doing anything
  if (!parsed.success) return Response.json({ ok: true })

  const email = parsed.data.email.trim().toLowerCase()
  if (!limits.forgot(email)) {
    return Response.json({ error: "Слишком много запросов. Попробуйте позже." }, { status: 429 })
  }

  const user = await db.user.findUnique({ where: { email } })
  // Only credentials users (with a password) can reset; Telegram-only accounts skip
  if (user?.passwordHash) {
    const token = crypto.randomBytes(32).toString("hex")
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
    await db.user.update({
      where: { id: user.id },
      data: { resetTokenHash: tokenHash, resetTokenExpiresAt: new Date(Date.now() + TTL_MS) },
    })
    void notifyPasswordReset(email, `${APP_URL}/reset/${token}`)
  }

  return Response.json({ ok: true })
}
