import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { deleteObject } from "@/lib/s3"
import { slugify } from "@/lib/slugify"
import { saleModelForKopecks } from "@/lib/tariffs"

type RouteParams = { params: Promise<{ id: string }> }

const STAFF_ROLES = new Set(["ADMIN", "MODERATOR"])

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
  telegramBotUsername: z.string().max(100).optional().or(z.literal("")),
  developerPaymentInfo: z.string().max(2000).optional().or(z.literal("")),
  demoUrl: z.string().url().optional().or(z.literal("")),
  videoUrl: z.string().url().optional().or(z.literal("")),
})

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }
  const role = (session.user as { role?: string }).role ?? ""
  if (!STAFF_ROLES.has(role)) {
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
  }

  // Название изменилось — обновляем slug (ссылки на productId не ломаются).
  if (d.title !== product.title) {
    data.slug = slugify(d.title)
  }
  // Цена изменилась — держим снапшот модели продажи в согласии с новой ценой.
  if (d.price !== product.price && product.saleModel !== null) {
    data.saleModel = saleModelForKopecks(d.price)
  }

  const updated = await db.product.update({ where: { id }, data })

  await db.moderationLog.create({
    data: {
      productId: id,
      moderatorId: session.user.id,
      action: "EDITED",
      comment: changes.length > 0 ? `Изменено: ${changes.join(", ")}` : "Карточка отредактирована",
    },
  })

  return Response.json({ ok: true, slug: updated.slug })
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const { id } = await params
  const product = await db.product.findUnique({ where: { id } })

  if (!product) {
    return Response.json({ error: "Продукт не найден" }, { status: 404 })
  }
  if (product.authorId !== session.user.id) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }
  if (!["DRAFT", "REJECTED"].includes(product.status)) {
    return Response.json({ error: "Нельзя удалить продукт с текущим статусом" }, { status: 409 })
  }

  const hasPurchases = await db.purchase.count({ where: { productId: id } })
  if (hasPurchases > 0) {
    return Response.json({ error: "Нельзя удалить продукт с покупками" }, { status: 409 })
  }

  // Собираем S3-ключи ДО удаления записей (файлы, версии, скриншоты).
  const [files, versions] = await Promise.all([
    db.productFile.findMany({ where: { productId: id }, select: { s3Key: true } }),
    db.productVersion.findMany({ where: { productId: id }, select: { s3Key: true } }),
  ])
  const s3Keys = [
    ...files.map((f) => f.s3Key),
    ...versions.map((v) => v.s3Key),
    ...product.screenshots,
  ].filter(Boolean)

  // Delete in dependency order (no cascade on ModerationLog/Review)
  await db.$transaction([
    db.moderationLog.deleteMany({ where: { productId: id } }),
    db.review.deleteMany({ where: { productId: id } }),
    db.wishlist.deleteMany({ where: { productId: id } }),
    db.product.delete({ where: { id } }),
  ])

  // Подчищаем файлы в S3 (best-effort — БД уже источник истины, ошибки S3 не валят ответ).
  await Promise.allSettled(s3Keys.map((key) => deleteObject(key)))

  return Response.json({ success: true })
}
