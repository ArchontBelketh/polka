import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getPresignedDownloadUrl } from "@/lib/s3"

type RouteParams = { params: Promise<{ id: string }> }

// Скачивание прикреплённого к заявке кода — только персонал (владелец/модератор).
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  const role = (session.user as { role?: string }).role ?? ""
  if (!["ADMIN", "MODERATOR"].includes(role)) {
    return Response.json({ error: "Нет доступа" }, { status: 403 })
  }

  const { id } = await params
  const request = await db.request.findUnique({
    where: { id },
    select: { codeS3Key: true, codeFileName: true },
  })
  if (!request?.codeS3Key) return Response.json({ error: "Код не прикреплён" }, { status: 404 })

  const url = await getPresignedDownloadUrl(request.codeS3Key, 900, request.codeFileName ?? undefined)
  return Response.redirect(url, 302)
}
