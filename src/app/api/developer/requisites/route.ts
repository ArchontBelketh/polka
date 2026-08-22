import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isInnValidForKind, ATTESTATION_VERSION, normalizePhone } from "@/lib/payout-profile"

const schema = z.object({
  kind: z.enum(["SELF_EMPLOYED", "ENTREPRENEUR", "COMPANY"]),
  displayName: z.string().trim().min(2, "Укажите ФИО или наименование").max(200),
  inn: z.string().trim().regex(/^\d{10}$|^\d{12}$/, "ИНН — 10 или 12 цифр"),
  phone: z.string().trim().min(1, "Укажите телефон"),
  attest: z.literal(true, { message: "Необходимо принять заверения" }),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }
  const profile = await db.payoutProfile.findUnique({ where: { userId: session.user.id } })
  return Response.json(profile)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!user || !["DEVELOPER", "ADMIN"].includes(user.role)) {
    return Response.json({ error: "Доступно только разработчикам" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { kind, displayName, inn } = parsed.data
  if (!isInnValidForKind(inn, kind)) {
    const expected = kind === "COMPANY" ? "10 цифр" : "12 цифр"
    return Response.json({ error: `Некорректный ИНН для выбранного статуса (${expected})` }, { status: 422 })
  }

  const phone = normalizePhone(parsed.data.phone)
  if (!phone) {
    return Response.json({ error: "Некорректный телефон. Формат: +7 900 000-00-00" }, { status: 422 })
  }

  // Смена реквизитов сбрасывает верификацию и провайдерского получателя —
  // при подключённом сплите потребуется заново подтвердить получателя.
  // Смена телефона сбрасывает phoneVerified (пригодится на этапе СМС).
  const profile = await db.payoutProfile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      kind,
      displayName,
      inn,
      phone,
      attestedAt: new Date(),
      attestVersion: ATTESTATION_VERSION,
    },
    update: {
      kind,
      displayName,
      inn,
      phone,
      phoneVerified: false,
      attestedAt: new Date(),
      attestVersion: ATTESTATION_VERSION,
      verified: false,
      providerRecipientId: null,
    },
  })

  return Response.json({ ok: true, id: profile.id })
}
