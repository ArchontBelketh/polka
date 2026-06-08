import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

type RouteParams = { params: Promise<{ id: string; versionId: string }> }

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend") }),
  z.object({ action: z.literal("restore") }),
  z.object({ action: z.literal("delete") }),
])

async function getOwnedVersion(productId: string, versionId: string, userId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { authorId: true },
  })
  if (!product || product.authorId !== userId) return null

  const version = await db.productVersion.findUnique({
    where: { id: versionId, productId },
  })
  return version
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const { id: productId, versionId } = await params
  const version = await getOwnedVersion(productId, versionId, session.user.id)
  if (!version) {
    return Response.json({ error: "Версия не найдена или нет доступа" }, { status: 404 })
  }

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { action } = parsed.data

  if (action === "suspend") {
    if (version.status !== "APPROVED") {
      return Response.json({ error: "Снять с публикации можно только опубликованную версию" }, { status: 422 })
    }
    await db.productVersion.update({
      where: { id: versionId },
      data: { status: "SUSPENDED" },
    })
    return Response.json({ status: "SUSPENDED" })
  }

  if (action === "restore") {
    if (version.status !== "SUSPENDED") {
      return Response.json({ error: "Восстановить можно только приостановленную версию" }, { status: 422 })
    }
    // Restore directly to APPROVED — file was already reviewed by a moderator
    await db.productVersion.update({
      where: { id: versionId },
      data: { status: "APPROVED" },
    })
    return Response.json({ status: "APPROVED" })
  }

  if (action === "delete") {
    if (version.status === "APPROVED") {
      return Response.json(
        { error: "Нельзя удалить опубликованную версию. Сначала снимите её с публикации." },
        { status: 422 },
      )
    }
    await db.productVersion.delete({ where: { id: versionId } })
    return Response.json({ deleted: true })
  }

  return Response.json({ error: "Неизвестное действие" }, { status: 400 })
}

// Convenience: DELETE method maps to the "delete" action
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const { id: productId, versionId } = await params
  const version = await getOwnedVersion(productId, versionId, session.user.id)
  if (!version) {
    return Response.json({ error: "Версия не найдена или нет доступа" }, { status: 404 })
  }

  if (version.status === "APPROVED") {
    return Response.json(
      { error: "Нельзя удалить опубликованную версию. Сначала снимите её с публикации." },
      { status: 422 },
    )
  }

  await db.productVersion.delete({ where: { id: versionId } })
  return Response.json({ deleted: true })
}
