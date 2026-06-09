import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { runVersionAutoModeration } from "@/lib/auto-moderation"

type RouteParams = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  version:   z.string().min(1).max(20),
  changelog: z.string().max(2000).optional(),
  s3Key:     z.string().default(""),
  fileName:  z.string().default(""),
  fileSize:  z.number().int().default(0),
})

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const { id } = await params

  const product = await db.product.findUnique({
    where: { id },
    select: { id: true, authorId: true, status: true },
  })

  if (!product) {
    return Response.json({ error: "Продукт не найден" }, { status: 404 })
  }
  if (product.authorId !== session.user.id) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }
  if (product.status !== "APPROVED") {
    return Response.json({ error: "Версии можно загружать только для опубликованных продуктов" }, { status: 422 })
  }

  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { version, changelog, s3Key, fileName, fileSize } = parsed.data

  // Check for duplicate version number
  const existing = await db.productVersion.findFirst({
    where: { productId: id, version },
    select: { id: true },
  })
  if (existing) {
    return Response.json({ error: `Версия ${version} уже существует` }, { status: 422 })
  }

  const productVersion = await db.productVersion.create({
    data: {
      productId: id,
      version,
      changelog,
      s3Key,
      fileName,
      fileSize,
      status: "PENDING",
    },
  })

  // Try auto-approval for verified developers; falls back silently to manual queue
  void runVersionAutoModeration(productVersion.id)

  return Response.json(
    { id: productVersion.id, version: productVersion.version, status: productVersion.status },
    { status: 201 },
  )
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const { id } = await params

  const product = await db.product.findUnique({
    where: { id },
    select: { authorId: true },
  })

  if (!product || product.authorId !== session.user.id) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }

  const versions = await db.productVersion.findMany({
    where: { productId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, version: true, changelog: true, fileName: true,
      fileSize: true, status: true, moderatorComment: true, createdAt: true,
    },
  })

  return Response.json(versions)
}
