import { db } from "@/lib/db"

export async function deleteProductDraft(productId: string, userId: string) {
  return db.$transaction(async (tx) => {
    const locked = await tx.product.updateMany({ where: { id: productId, authorId: userId, status: { in: ["DRAFT", "REJECTED"] }, publishedAt: null }, data: { updatedAt: new Date() } })
    if (!locked.count || await tx.purchase.count({ where: { productId } })) return null
    const [product, files, versions, uploads] = await Promise.all([
      tx.product.findUnique({ where: { id: productId }, select: { screenshots: true } }),
      tx.productFile.findMany({ where: { productId }, select: { s3Key: true } }),
      tx.productVersion.findMany({ where: { productId }, select: { s3Key: true } }),
      tx.productUpload.findMany({ where: { productId }, select: { stagingKey: true, artifactKey: true } }),
    ])
    const keys = [...new Set([...files.map((file) => file.s3Key), ...versions.map((file) => file.s3Key), ...uploads.flatMap((upload) => [upload.stagingKey, upload.artifactKey]), ...(product?.screenshots ?? [])].filter((key): key is string => !!key))]
    await tx.moderationLog.deleteMany({ where: { productId } })
    await tx.review.deleteMany({ where: { productId } })
    await tx.wishlist.deleteMany({ where: { productId } })
    await tx.product.delete({ where: { id: productId } })
    return keys
  })
}
