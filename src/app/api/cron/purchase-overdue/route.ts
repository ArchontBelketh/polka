import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { recordCronRun } from "@/lib/cron-heartbeat"
import { notifyPurchaseReminder, notifyPurchaseExpired } from "@/lib/notify"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

// Напоминание автору (24ч) и просрочка заявок (72ч) по прямой оплате.
// curl -X POST .../api/cron/purchase-overdue -H "x-cron-secret: $CRON_SECRET"
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || cronSecret.length < 32) {
    console.error("CRON_SECRET is not set or too short — cron endpoint is disabled")
    return Response.json({ error: "Service unavailable" }, { status: 503 })
  }
  if (req.headers.get("x-cron-secret") !== cronSecret) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const now = Date.now()
  const h24 = new Date(now - 24 * 3600_000)
  const h72 = new Date(now - 72 * 3600_000)

  // 72ч без подтверждения → EXPIRED
  const expired = await db.purchase.findMany({
    where: { status: "AWAITING", createdAt: { lt: h72 } },
    include: {
      product: { select: { title: true } },
      buyer: { select: { telegramId: true, email: true } },
    },
  })
  for (const p of expired) {
    await db.purchase.update({ where: { id: p.id }, data: { status: "EXPIRED" } })
    void notifyPurchaseExpired({
      buyerTelegramId: p.buyer.telegramId,
      buyerEmail: p.buyer.email,
      productTitle: p.product.title,
      purchaseUrl: `${APP_URL}/purchases/${p.id}`,
    })
  }

  // 24ч без ответа (ещё не просрочено) → напоминание автору (один раз)
  const toRemind = await db.purchase.findMany({
    where: { status: "AWAITING", createdAt: { lt: h24, gte: h72 }, reminderSentAt: null },
    include: {
      product: { select: { title: true, author: { select: { telegramId: true, email: true } } } },
    },
  })
  for (const p of toRemind) {
    await db.purchase.update({ where: { id: p.id }, data: { reminderSentAt: new Date() } })
    void notifyPurchaseReminder({
      developerTelegramId: p.product.author.telegramId,
      developerEmail: p.product.author.email,
      productTitle: p.product.title,
      confirmUrl: `${APP_URL}/dashboard/confirmations`,
    })
  }

  await recordCronRun("purchase-overdue")
  return Response.json({ expired: expired.length, reminded: toRemind.length })
}
