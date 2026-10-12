import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { limits } from "@/lib/ratelimit"
import { notifyNewComplaint } from "@/lib/notify"

const schema = z.object({
  claimant: z.string().trim().min(2, "Укажите заявителя").max(300),
  contact: z.string().trim().min(3).max(200),
  productUrl: z.string().trim().max(500).optional(),
  protectedObj: z.string().trim().min(2).max(2000),
  rightsProof: z.string().trim().min(2).max(2000),
  description: z.string().trim().min(5).max(5000),
  consentPd: z.literal(true),
})

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  if (!limits.request(ip)) {
    return Response.json({ error: "Слишком много обращений. Попробуйте позже." }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Проверьте поля формы и согласие." }, { status: 422 })
  }
  const d = parsed.data

  // Пытаемся привязать товар по слагу из ссылки (/product/<slug>).
  let productId: string | null = null
  if (d.productUrl) {
    const m = d.productUrl.match(/\/product\/([A-Za-z0-9-]+)/)
    if (m) {
      const product = await db.product.findUnique({ where: { slug: m[1] }, select: { id: true } })
      productId = product?.id ?? null
    }
  }

  const complaint = await db.rightsComplaint.create({
    data: {
      claimant: d.claimant,
      contact: d.contact,
      productUrl: d.productUrl || null,
      productId,
      protectedObj: d.protectedObj,
      rightsProof: d.rightsProof,
      description: d.description,
      consentPd: true,
    },
  })

  void notifyNewComplaint({ complaintId: complaint.id, claimant: d.claimant, productUrl: d.productUrl })

  return Response.json({ ok: true, complaintId: complaint.id }, { status: 201 })
}
