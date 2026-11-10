import { db } from "@/lib/db"

export async function requestDirectPurchase(buyerId: string, productId: string) {
  return db.$transaction(async (tx) => {
    // Serializes competing requests for one product in both PostgreSQL and YDB.
    // Price and publication state are read after acquiring the parent lock.
    const locked = await tx.product.updateMany({ where: { id: productId, status: "APPROVED" }, data: { updatedAt: new Date() } })
    if (!locked.count) return { status: 404 as const, error: "Продукт недоступен для покупки" }
    const product = await tx.product.findUnique({ where: { id: productId }, include: {
      author: { select: { telegramId: true, email: true, payoutProfile: { select: { paymentLink: true } } } },
      files: { where: { fileType: "SOURCE" }, orderBy: { createdAt: "asc" }, take: 1 },
      versions: { where: { status: "APPROVED", s3Key: { not: "" } }, orderBy: { createdAt: "desc" }, take: 1 },
    } })
    if (!product) return { status: 404 as const, error: "Продукт недоступен для покупки" }
    if (product.authorId === buyerId) return { status: 400 as const, error: "Нельзя купить собственный продукт" }
    const existing = await tx.purchase.findFirst({ where: { buyerId, productId, status: { in: ["PENDING", "AWAITING", "PAID", "DELIVERED", "DISPUTED"] } }, select: { id: true } })
    if (existing) return { status: 409 as const, error: "Заявка по этому продукту уже оформлена", purchaseId: existing.id }
    if (!product.author.payoutProfile?.paymentLink) return { status: 400 as const, error: "У автора не указана ссылка для оплаты" }
    const key = product.versions[0]?.s3Key || product.files[0]?.s3Key
    if (!key || key.startsWith("local/")) return { status: 409 as const, error: "Файл продукта пока не готов к выдаче. Обратитесь к автору." }
    const purchase = await tx.purchase.create({ data: { buyerId, productId, amount: product.price, status: "AWAITING" } })
    return { status: 201 as const, purchaseId: purchase.id, notice: { developerTelegramId: product.author.telegramId, developerEmail: product.author.email, productTitle: product.title } }
  })
}

export async function saveVerifiedReview(userId: string, productId: string, rating: number, text: string) {
  return db.$transaction(async (tx) => {
    const locked = await tx.product.updateMany({ where: { id: productId }, data: { updatedAt: new Date() } })
    if (!locked.count) return { status: 404 as const, error: "Продукт не найден" }
    const product = await tx.product.findUnique({ where: { id: productId }, select: { authorId: true } })
    if (product?.authorId === userId) return { status: 403 as const, error: "Нельзя оценивать собственный продукт" }
    const paid = await tx.purchase.findFirst({ where: { buyerId: userId, productId, status: { in: ["PAID", "DELIVERED"] } }, select: { id: true } })
    if (!paid) return { status: 403 as const, error: "Оставить отзыв можно только после покупки" }
    const review = await tx.review.upsert({
      where: { productId_authorId: { productId, authorId: userId } },
      create: { productId, authorId: userId, rating, text }, update: { rating, text },
      include: { author: { select: { id: true, name: true, telegramHandle: true } } },
    })
    const aggregate = await tx.review.aggregate({ where: { productId }, _avg: { rating: true }, _count: { id: true } })
    await tx.product.update({ where: { id: productId }, data: { rating: Math.round((aggregate._avg.rating ?? 0) * 10) / 10, reviewCount: aggregate._count.id } })
    return { status: 201 as const, review }
  })
}
