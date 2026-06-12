import { NextRequest } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Минимум 8 символов").max(200),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { token, password } = parsed.data
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

  const user = await db.user.findFirst({
    where: { resetTokenHash: tokenHash, resetTokenExpiresAt: { gt: new Date() } },
    select: { id: true },
  })
  if (!user) {
    return Response.json({ error: "Ссылка недействительна или истекла" }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash, resetTokenHash: null, resetTokenExpiresAt: null },
  })

  return Response.json({ ok: true })
}
