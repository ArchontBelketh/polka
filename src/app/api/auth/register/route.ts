import { NextRequest } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"

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

  const { name, email, password, asDeveloper } = parsed.data

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return Response.json({ error: "Этот email уже используется" }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: asDeveloper ? "DEVELOPER" : "BUYER",
      agreedToTerms: true,
      agreedAt: new Date(),
    },
  })

  return Response.json({ id: user.id, email: user.email, role: user.role }, { status: 201 })
}
