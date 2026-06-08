import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getPresignedUploadUrl, productSourceKey, screenshotKey } from "@/lib/s3"

const ALLOWED_SOURCE_TYPES = new Set([
  "application/zip", "application/x-zip-compressed",
  "text/x-python", "application/octet-stream",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "application/x-xlsm",
])

const ALLOWED_SCREENSHOT_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp",
])

const uploadSchema = z.object({
  productId: z.string(),
  type: z.enum(["source", "screenshot"]),
  fileName: z.string().min(1).max(200),
  fileSize: z.number().int().positive().max(100 * 1024 * 1024), // 100 MB max
  contentType: z.string(),
  screenshotIndex: z.number().int().min(0).max(9).optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = uploadSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { productId, type, fileName, fileSize, contentType, screenshotIndex } = parsed.data

  // Verify ownership
  const product = await db.product.findUnique({ where: { id: productId } })
  if (!product) {
    return Response.json({ error: "Продукт не найден" }, { status: 404 })
  }
  if (product.authorId !== session.user.id) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }

  if (type === "source") {
    if (!ALLOWED_SOURCE_TYPES.has(contentType) && !isAllowedByExtension(fileName)) {
      return Response.json({ error: "Недопустимый тип файла" }, { status: 422 })
    }
    const key = productSourceKey(productId, fileName)
    const url = await getPresignedUploadUrl(key, contentType)

    // Create ProductFile record
    const ext = fileName.split(".").pop() ?? ""
    await db.productFile.create({
      data: {
        productId,
        s3Key: key,
        fileName,
        fileSize,
        fileType: "SOURCE",
        format: `.${ext}`,
      },
    })

    return Response.json({ url, key })
  }

  if (type === "screenshot") {
    if (!ALLOWED_SCREENSHOT_TYPES.has(contentType)) {
      return Response.json({ error: "Скриншоты должны быть JPEG/PNG/WebP" }, { status: 422 })
    }
    const idx = screenshotIndex ?? 0
    const ext = contentType.split("/")[1]
    const key = screenshotKey(productId, idx, ext)
    const url = await getPresignedUploadUrl(key, contentType)

    // Append screenshot key to product
    const screenshots = [...product.screenshots, key]
    await db.product.update({ where: { id: productId }, data: { screenshots } })

    return Response.json({ url, key })
  }

  return Response.json({ error: "Неизвестный тип" }, { status: 400 })
}

function isAllowedByExtension(name: string): boolean {
  const allowed = [".zip", ".py", ".js", ".ts", ".epf", ".erf", ".xlsm", ".xls"]
  return allowed.some((ext) => name.toLowerCase().endsWith(ext))
}
