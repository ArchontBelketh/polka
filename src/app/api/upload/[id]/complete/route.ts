import { getCurrentUser } from "@/lib/current-user"
import { completeProductUpload } from "@/lib/product-uploads"
import { ProductUploadError } from "@/lib/product-upload-policy"
import { limits } from "@/lib/ratelimit"
import { canManageCode } from "@/lib/permissions"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  if (!canManageCode(user.role)) return Response.json({ error: "Недостаточно прав" }, { status: 403 })
  if (!limits.upload(user.id)) return Response.json({ error: "Слишком много запросов" }, { status: 429 })
  try { return Response.json(await completeProductUpload(user.id, (await params).id)) }
  catch (error) {
    if (error instanceof ProductUploadError) return Response.json({ error: error.message }, { status: error.status })
    return Response.json({ error: "Не удалось проверить загрузку. Повторите попытку; подтверждённые файлы сохранятся." }, { status: 503 })
  }
}
