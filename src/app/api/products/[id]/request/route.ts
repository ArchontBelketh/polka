import { getCurrentUser } from "@/lib/current-user"
import { requestDirectPurchase } from "@/lib/store-transactions"
import { notifyListingPurchaseRequested } from "@/lib/notify"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  if (!process.env.YANDEX_S3_ACCESS_KEY || !process.env.YANDEX_S3_SECRET_KEY) return Response.json({ error: "Хранилище файлов временно недоступно" }, { status: 503 })
  const result = await requestDirectPurchase(user.id, (await params).id)
  if (result.status !== 201) return Response.json({ error: result.error, ...("purchaseId" in result ? { purchaseId: result.purchaseId } : {}) }, { status: result.status })
  void notifyListingPurchaseRequested({ ...result.notice, confirmUrl: `${APP_URL}/dashboard/confirmations` }).catch(() => { console.error("Purchase request saved; notification failed") })
  return Response.json({ purchaseId: result.purchaseId }, { status: 201 })
}
