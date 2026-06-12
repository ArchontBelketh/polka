import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { limits } from "@/lib/ratelimit"
import { issueEmailVerification } from "@/lib/email-verify"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  if (!limits.forgot(session.user.id)) {
    return Response.json({ error: "Слишком часто. Попробуйте позже." }, { status: 429 })
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true },
  })
  if (!user?.email) {
    return Response.json({ error: "У аккаунта нет email" }, { status: 400 })
  }
  if (user.emailVerified) {
    return Response.json({ ok: true, alreadyVerified: true })
  }

  await issueEmailVerification(session.user.id, user.email)
  return Response.json({ ok: true })
}
