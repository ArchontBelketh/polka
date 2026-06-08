import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { getPayment } from "@/lib/yookassa"
import { escrowUntilDate } from "@/lib/escrow"

// YooKassa whitelisted IP ranges (verify at nginx level in production)
const YOOKASSA_IPS = new Set([
  "185.71.76.0", "185.71.77.0", "77.75.153.0", "77.75.156.11", "77.75.156.35",
])

interface WebhookBody {
  type: string
  event: string
  object: {
    id: string
    status: string
    metadata?: Record<string, string>
  }
}

export async function POST(req: NextRequest) {
  let body: WebhookBody
  try {
    body = await req.json()
  } catch {
    return new Response("Bad Request", { status: 400 })
  }

  if (body.type !== "notification") {
    return new Response("OK", { status: 200 })
  }

  const { event, object: payment } = body

  if (event === "payment.succeeded") {
    const purchaseId = payment.metadata?.purchaseId
    if (!purchaseId) {
      console.error("Webhook: missing purchaseId in metadata", payment.id)
      return new Response("OK", { status: 200 })
    }

    // Re-fetch from YooKassa to verify the status
    let verified
    try {
      verified = await getPayment(payment.id)
    } catch (err) {
      console.error("Webhook: failed to verify payment", err)
      return new Response("Error", { status: 502 })
    }

    if (verified.status !== "succeeded") {
      return new Response("OK", { status: 200 })
    }

    const purchase = await db.purchase.findUnique({
      where: { id: purchaseId },
      include: { product: { select: { authorId: true, salesCount: true } } },
    })

    if (!purchase) {
      console.error("Webhook: purchase not found", purchaseId)
      return new Response("OK", { status: 200 })
    }

    if (purchase.status !== "PENDING") {
      // Already processed (idempotency)
      return new Response("OK", { status: 200 })
    }

    await db.$transaction(async (tx) => {
      await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          status: "PAID",
          paymentId: payment.id,
          paidAt: new Date(),
          escrowUntil: escrowUntilDate(),
        },
      })
      await tx.product.update({
        where: { id: purchase.productId },
        data: { salesCount: { increment: 1 } },
      })
    })
  }

  if (event === "payment.canceled") {
    const purchaseId = payment.metadata?.purchaseId
    if (purchaseId) {
      await db.purchase.updateMany({
        where: { id: purchaseId, status: "PENDING" },
        data: { status: "REFUNDED" },
      })
    }
  }

  return new Response("OK", { status: 200 })
}
