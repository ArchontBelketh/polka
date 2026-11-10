import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/current-user"
import { canManageCode } from "@/lib/permissions"
import { EDITABLE_SPECIFICATION_STATUSES, productSpecificationSchema, specificationData } from "@/lib/product-specification"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  if (!canManageCode(user.role)) return Response.json({ error: "Недостаточно прав" }, { status: 403 })
  const { id } = await params
  const product = await db.product.findUnique({ where: { id }, select: { authorId: true } })
  if (!product) return Response.json({ error: "Товар не найден" }, { status: 404 })
  if (product.authorId !== user.id) return Response.json({ error: "Нет доступа" }, { status: 403 })
  let body: unknown
  try { body = await req.json() } catch { return Response.json({ error: "Некорректный JSON" }, { status: 400 }) }
  const parsed = productSpecificationSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Проверьте характеристики" }, { status: 422 })
  const data = specificationData(parsed.data)
  const saved = await db.$transaction(async (tx) => {
    // Lock and recheck publication state together with the specification write.
    // A moderator winning this race must prevent any later author edits.
    const editable = await tx.product.updateMany({ where: { id, authorId: user.id, status: { in: [...EDITABLE_SPECIFICATION_STATUSES] } }, data: { updatedAt: new Date() } })
    if (!editable.count) return false
    await tx.productSpecification.upsert({ where: { productId: id }, create: { productId: id, ...data }, update: data })
    return true
  })
  if (!saved) return Response.json({ error: "Характеристики можно менять только в черновике или после отклонения. Для опубликованного товара обратитесь к модератору." }, { status: 409 })
  return Response.json({ ok: true })
}
