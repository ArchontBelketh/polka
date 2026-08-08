import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getObjectBuffer } from "@/lib/s3"
import { readCodeFromBuffer, type CodeFile } from "@/lib/code-viewer"

type RouteParams = { params: Promise<{ id: string }> }

// Просмотр исходного кода продукта модератором/админом.
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) {
    return Response.json({ error: "Недостаточно прав" }, { status: 403 })
  }

  const { id } = await params
  const files = await db.productFile.findMany({
    where: { productId: id, fileType: "SOURCE" },
    orderBy: { createdAt: "asc" },
    select: { s3Key: true, fileName: true },
  })
  if (files.length === 0) {
    return Response.json({ kind: "unsupported", files: [], note: "Нет исходных файлов" })
  }

  const s3Configured = !!process.env.YANDEX_S3_ACCESS_KEY && !!process.env.YANDEX_S3_SECRET_KEY
  if (!s3Configured) {
    return Response.json({ kind: "unsupported", files: [], note: "Хранилище файлов не настроено" })
  }

  const collected: CodeFile[] = []
  let usedArchive = false

  for (const f of files) {
    if (!f.s3Key || f.s3Key.startsWith("local/")) {
      collected.push({ path: f.fileName, size: 0, skipped: "недоступен в этой среде" })
      continue
    }
    try {
      const buf = await getObjectBuffer(f.s3Key)
      const res = await readCodeFromBuffer(f.fileName, buf)
      if (res.kind === "archive") {
        usedArchive = true
        // Префикс именем архива, если исходников несколько
        const prefix = files.length > 1 ? `${f.fileName}/` : ""
        for (const cf of res.files) collected.push({ ...cf, path: prefix + cf.path })
      } else {
        collected.push(...res.files)
      }
    } catch {
      collected.push({ path: f.fileName, size: 0, skipped: "не удалось загрузить из хранилища" })
    }
  }

  const kind = usedArchive || collected.length > 1 ? "archive" : "single"
  return Response.json({ kind, files: collected })
}
