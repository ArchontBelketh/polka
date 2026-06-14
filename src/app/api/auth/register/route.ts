import { NextRequest } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { issueEmailVerification } from "@/lib/email-verify"
import { isEmailDomainAllowed, emailDomainError } from "@/lib/email-domains"

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  asDeveloper: z.boolean().default(false),
  agreedToTerms: z.literal(true, {
    message: "Необходимо согласие с условиями и обработкой ПДн",
  }),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.find((i) => i.path[0] === "agreedToTerms")?.message
    return Response.json({ error: msg ?? "Проверьте введённые данные" }, { status: 422 })
  }

  const { name, password, asDeveloper } = parsed.data
  // Нормализуем email: уникальный индекс в БД регистрозависим, поэтому без
  // приведения к нижнему регистру User@x и user@x = два разных аккаунта.
  const email = parsed.data.email.trim().toLowerCase()

  if (!isEmailDomainAllowed(email)) {
    return Response.json({ error: emailDomainError() }, { status: 422 })
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return Response.json({ error: "Этот email уже используется" }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  let user
  try {
    user = await db.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: asDeveloper ? "DEVELOPER" : "BUYER",
        agreedToTerms: true,
        agreedAt: new Date(),
      },
    })
  } catch (e) {
    // Гонка: между findUnique и create email мог занять параллельный запрос.
    // P2002 — нарушение уникального индекса → отдаём тот же 409, а не 500.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return Response.json({ error: "Этот email уже используется" }, { status: 409 })
    }
    throw e
  }

  // Send the email-verification link (non-blocking — account is usable, but
  // unverified users can't post reviews/questions until they confirm)
  void issueEmailVerification(user.id, email)

  return Response.json({ id: user.id, email: user.email, role: user.role }, { status: 201 })
}
