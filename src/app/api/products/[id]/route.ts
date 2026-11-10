import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { deleteObject } from "@/lib/s3"
import { saleModelForKopecks } from "@/lib/tariffs"
import { getCurrentUser } from "@/lib/current-user"
import { isStaff } from "@/lib/permissions"
import { productSpecificationSchema, specificationData } from "@/lib/product-specification"
import { deleteProductDraft } from "@/lib/product-draft-delete"

type RouteParams = { params: Promise<{ id: string }> }

// Полное редактирование карточки персоналом (ADMIN/MODERATOR) — от названия до цены.
const editSchema = z.object({
  title: z.string().min(5).max(120),
  shortDesc: z.string().min(10).max(300),
  fullDesc: z.string().min(30),
  category: z.enum(["TELEGRAM", "PARSER", "EXCEL", "AUTOMATION", "WEB"]),
  price: z.number().int().positive(),
  features: z.array(z.string().min(1)).min(1).max(20),
  installGuide: z.string().min(200, "Инструкция минимум 200 символов").max(20000),
  requirements: z.array(z.string().min(1).max(100)).max(15).default([]),
  targetAudience: z.string().max(300).optional().or(z.literal("")),
  techStack: z.array(z.string().max(50)).max(10).default([]),
  license: z.string().default("personal"),
  specification: productSpecificationSchema.optional(),
  telegramBotUsername: z.string().max(100).optional().or(z.literal("")),
  developerPaymentInfo: z.string().max(2000).optional().or(z.literal("")),
  demoUrl: z.string().url().optional().or(z.literal("")),
  videoUrl: z.string().url().optional().or(z.literal("")),
  exampleInput: z.string().max(5000).optional().or(z.literal("")),
  exampleOutput: z.string().max(5000).optional().or(z.literal("")),
})

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }
  if (!isStaff(user.role)) {
    return Response.json({ error: "Редактировать карточку может только персонал" }, { status: 403 })
  }

  const { id } = await params
  const product = await db.product.findUnique({ where: { id } })
  if (!product) {
    return Response.json({ error: "Продукт не найден" }, { status: 404 })
  }

  const body = await req.json().catch(() => null)
  const parsed = editSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }
  const d = parsed.data

  // Определяем изменённые поля для аудит-лога.
  const changes: string[] = []
  if (d.title !== product.title) changes.push("название")
  if (d.price !== product.price) changes.push("цена")
  if (d.category !== product.category) changes.push("категория")
  if (d.shortDesc !== product.shortDesc || d.fullDesc !== product.fullDesc) changes.push("описание")
  if (d.specification) changes.push("характеристики и условия")

  const data: Record<string, unknown> = {
    title: d.title,
    shortDesc: d.shortDesc,
    fullDesc: d.fullDesc,
    category: d.category,
    price: d.price,
    features: d.features,
    installGuide: d.installGuide,
    requirements: d.requirements,
    techStack: d.techStack,
    license: d.license,
    targetAudience: d.targetAudience || null,
    telegramBotUsername: d.telegramBotUsername || null,
    developerPaymentInfo: d.developerPaymentInfo || null,
    demoUrl: d.demoUrl || null,
    videoUrl: d.videoUrl || null,
    exampleInput: d.exampleInput || null,
    exampleOutput: d.exampleOutput || null,
  }

  // Keep the public URL stable when a moderator corrects the title.
  // Цена изменилась — держим снапшот модели продажи в согласии с новой ценой.
  if (d.price !== product.price && product.saleModel !== null) {
    data.saleModel = saleModelForKopecks(d.price)
  }

  const updated = await db.$transaction(async (tx) => {
    const updated = await tx.product.update({ where: { id }, data })
    if (d.specification) {
      const specification = specificationData(d.specification)
      await tx.productSpecification.upsert({ where: { productId: id }, create: { productId: id, ...specification }, update: specification })
    }
    await tx.moderationLog.create({ data: {
      productId: id, moderatorId: user.id, action: "EDITED",
      comment: changes.length > 0 ? `Изменено: ${changes.join(", ")}` : "Карточка отредактирована",
    } })
    return updated
  })

  return Response.json({ ok: true, slug: updated.slug })
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const { id } = await params
  const product = await db.product.findUnique({ where: { id } })

  if (!product) {
    return Response.json({ error: "Продукт не найден" }, { status: 404 })
  }
  if (product.authorId !== user.id) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }
  const s3Keys = await deleteProductDraft(id, user.id)
  if (!s3Keys) return Response.json({ error: "Можно удалить только неопубликованный черновик без покупок" }, { status: 409 })

  // Подчищаем файлы в S3 (best-effort — БД уже источник истины, ошибки S3 не валят ответ).
  await Promise.allSettled(s3Keys.map((key) => deleteObject(key)))

  return Response.json({ success: true })
}
