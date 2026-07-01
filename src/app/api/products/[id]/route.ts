import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { deleteObject } from "@/lib/s3"

type RouteParams = { params: Promise<{ id: string }> }

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
