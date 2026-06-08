import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getPresignedDownloadUrl } from "@/lib/s3"

type RouteParams = { params: Promise<{ purchaseId: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const { purchaseId } = await params

  const purchase = await db.purchase.findUnique({
    where: { id: purchaseId },
    include: {
      product: {
        include: { files: { where: { fileType: "SOURCE" }, take: 1 } },
      },
    },
  })

  if (!purchase) {
    return Response.json({ error: "Покупка не найдена" }, { status: 404 })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  const isAdmin = user?.role === "ADMIN" || user?.role === "MODERATOR"

  if (purchase.buyerId !== session.user.id && !isAdmin) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }

  if (purchase.status !== "PAID" && purchase.status !== "DELIVERED") {
    return Response.json({ error: "Продукт недоступен для скачивания" }, { status: 403 })
  }

  const file = purchase.product.files[0]
  if (!file) {
    return Response.json({ error: "Файл не найден" }, { status: 404 })
  }

  const s3Configured = !!process.env.YANDEX_S3_ACCESS_KEY && !!process.env.YANDEX_S3_SECRET_KEY
  if (!s3Configured || file.s3Key.startsWith("local/")) {
    return Response.json(
      { error: "Хранилище файлов не настроено. В локальной среде скачивание недоступно." },
      { status: 503 },
    )
  }

  const url = await getPresignedDownloadUrl(file.s3Key, 900)

  await db.purchase.update({
    where: { id: purchaseId },
    data: { downloadCount: { increment: 1 } },
  })

  return Response.redirect(url, 302)
}
