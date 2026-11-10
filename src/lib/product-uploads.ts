import { db } from "@/lib/db"
import { getObjectBuffer, snapshotProductFile, snapshotProductImage, deleteObject, productSourceKey, productScreenshotUploadKey, MAX_SCREENSHOT_BYTES } from "@/lib/s3"
import { EDITABLE_UPLOAD_STATUSES, isUploadEditable, ProductUploadError } from "@/lib/product-upload-policy"

export interface UploadInput {
  id: string; productId: string; type: "source" | "screenshot";
  slot: number; fileName: string; fileSize: number; contentType: string
}

export async function prepareProductUpload(userId: string, input: UploadInput) {
  return db.$transaction(async (tx) => {
    const locked = await tx.product.updateMany({ where: { id: input.productId, authorId: userId, status: { in: [...EDITABLE_UPLOAD_STATUSES] }, publishedAt: null }, data: { updatedAt: new Date() } })
    if (!locked.count || await tx.purchase.count({ where: { productId: input.productId } })) throw new ProductUploadError("Базовые файлы опубликованного товара менять нельзя. Используйте новую версию.", 409)
    const existing = await tx.productUpload.findUnique({ where: { id: input.id } })
    if (existing) {
      if (["productId", "type", "slot", "fileName", "fileSize", "contentType"].some((key) => existing[key as keyof typeof existing] !== input[key as keyof UploadInput])) throw new ProductUploadError("Эта попытка загрузки уже используется для другого файла", 409)
      if (existing.status === "CANCELLED") throw new ProductUploadError("Срок попытки загрузки истёк. Повторите загрузку файла.", 410)
      return existing.status === "PENDING" ? tx.productUpload.update({ where: { id: existing.id }, data: { updatedAt: new Date() } }) : existing
    }
    const stagingKey = input.type === "source" ? productSourceKey(input.productId, input.fileName) : productScreenshotUploadKey(input.productId, input.slot, input.contentType.split("/")[1])
    const { id, ...data } = input
    return tx.productUpload.create({ data: { id, ...data, stagingKey } })
  })
}

export async function completeProductUpload(userId: string, uploadId: string) {
  const upload = await db.productUpload.findUnique({ where: { id: uploadId }, include: { product: { select: { authorId: true, status: true, publishedAt: true } } } })
  if (!upload) throw new ProductUploadError("Попытка загрузки не найдена", 404)
  if (upload.product.authorId !== userId) throw new ProductUploadError("Нет доступа", 403)
  if (upload.status === "COMPLETED") return { completed: true, uploadId }
  if (upload.status === "CANCELLED") throw new ProductUploadError("Срок попытки загрузки истёк", 410)
  if (!isUploadEditable(upload.product)) throw new ProductUploadError("Товар уже опубликован или отправлен на проверку", 409)
  let buffer: Buffer
  try { buffer = await getObjectBuffer(upload.stagingKey, upload.type === "screenshot" ? MAX_SCREENSHOT_BYTES : undefined) }
  catch (error) { if (error instanceof RangeError) throw new ProductUploadError("Файл превышает допустимый размер", 422); throw error }
  if (buffer.length !== upload.fileSize) throw new ProductUploadError("Загруженный файл не соответствует заявленному размеру", 422)
  let snapshot: { key: string; sha256: string; fileSize: number }
  try { snapshot = upload.type === "source" ? await snapshotProductFile(upload.productId, buffer, upload.fileName) : await snapshotProductImage(upload.productId, buffer, upload.contentType) }
  catch (error) { if (error instanceof RangeError) throw new ProductUploadError(error.message, 422); throw error }
  // Never delete a new artifact after an uncertain transaction outcome. A retry
  // observes COMPLETED; cleanup only follows a confirmed unused-copy result.
  const stored = await db.$transaction(async (tx) => {
    const locked = await tx.product.updateMany({ where: { id: upload.productId, authorId: userId, status: { in: [...EDITABLE_UPLOAD_STATUSES] }, publishedAt: null }, data: { updatedAt: new Date() } })
    const fresh = await tx.productUpload.findUnique({ where: { id: uploadId } })
    if (fresh?.status === "COMPLETED") return "already" as const
    if (!locked.count || await tx.purchase.count({ where: { productId: upload.productId } })) return "blocked" as const
    if (!fresh || fresh.status !== "PENDING") return "blocked" as const
    if (upload.type === "source") {
      await tx.productFile.deleteMany({ where: { productId: upload.productId, fileType: "SOURCE" } })
      await tx.productFile.create({ data: { id: uploadId, productId: upload.productId, fileType: "SOURCE", fileName: upload.fileName, fileSize: snapshot.fileSize, s3Key: snapshot.key, sha256: snapshot.sha256, format: `.${upload.fileName.split(".").pop() ?? ""}` } })
    } else {
      const product = await tx.product.findUnique({ where: { id: upload.productId }, select: { screenshots: true } })
      const screenshots = [...(product?.screenshots ?? [])]
      if (upload.slot > screenshots.length) throw new ProductUploadError("Загружайте скриншоты по порядку", 409)
      screenshots[upload.slot] = snapshot.key
      await tx.product.update({ where: { id: upload.productId }, data: { screenshots } })
    }
    await tx.productUpload.update({ where: { id: uploadId }, data: { status: "COMPLETED", artifactKey: snapshot.key, completedAt: new Date() } })
    return "stored" as const
  })
  if (stored !== "stored") await deleteObject(snapshot.key).catch(() => {})
  if (stored === "blocked") throw new ProductUploadError("Состояние товара или загрузки изменилось. Обновите страницу.", 409)
  return { completed: true, uploadId }
}
