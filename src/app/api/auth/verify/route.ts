import { NextRequest } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import { db } from "@/lib/db"

const schema = z.object({ token: z.string().min(10) })

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Некорректная ссылка" }, { status: 422 })
  }

  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex")
  const user = await db.user.findFirst({
    where: { emailVerifyTokenHash: tokenHash },
    select: { id: true },
  })
  if (!user) {
    return Response.json({ error: "Ссылка недействительна или уже использована" }, { status: 400 })
  }

  await db.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date(), emailVerifyTokenHash: null },
  })

  return Response.json({ ok: true })
}
