import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { getPayment } from "@/lib/yookassa"
import { escrowUntilDate } from "@/lib/escrow"
import { notifyNewSale } from "@/lib/notify"
import { ipInCidr, clientIp } from "@/lib/ip"

// YooKassa notification source ranges (CIDR) — enforced in application code,
// not only at nginx. Verify against the current list in the YooKassa docs
// (Webhooks → Безопасность) on deploy.
const YOOKASSA_CIDRS = [
  "185.71.76.0/27",
  "185.71.77.0/27",
  "77.75.153.0/25",
  "77.75.156.11/32",
  "77.75.156.35/32",
  "77.75.154.128/25",
]

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
  // Enforce YooKassa CIDR allowlist against a trusted IP source
  const ip = clientIp(req)
  const allowed = ip !== "" && YOOKASSA_CIDRS.some((cidr) => ipInCidr(ip, cidr))
  if (!allowed) {
    console.warn("Webhook: rejected request from non-YooKassa IP:", ip || "(none)")
    return new Response("Forbidden", { status: 403 })
  }

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

    // Use verified.metadata (authoritative from YooKassa) — never trust request body metadata
    const meta = verified.metadata ?? {}
    const metaType = meta.type ?? "purchase"

    // --- Product purchase ---
    if (metaType === "purchase" || !meta.type) {
      const purchaseId = meta.purchaseId
      if (!purchaseId) {
        console.error("Webhook: missing purchaseId in metadata", payment.id)
        return new Response("OK", { status: 200 })
      }

      const purchase = await db.purchase.findUnique({
        where: { id: purchaseId },
        include: {
          product: { select: { authorId: true, salesCount: true, title: true } },
          buyer: { select: { email: true } },
        },
      })

      if (!purchase) {
        console.error("Webhook: purchase not found", purchaseId)
        return new Response("OK", { status: 200 })
      }

      if (purchase.status !== "PENDING") {
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

      const developer = await db.user.findUnique({
        where: { id: purchase.product.authorId },
        select: { telegramId: true },
      })
      void notifyNewSale({
        developerTelegramId: developer?.telegramId ?? null,
        productTitle: purchase.product.title,
        amountKopecks: purchase.amount,
        buyerEmail: purchase.buyer.email,
      })
    }

    // --- Slot purchase ---
    if (metaType === "slots") {
      const { userId, slotsAdded } = meta
      if (!userId || !slotsAdded) return new Response("OK", { status: 200 })

      const slots = parseInt(slotsAdded, 10)
      if (isNaN(slots) || slots <= 0) return new Response("OK", { status: 200 })

      await db.$transaction(async (tx) => {
        await tx.slotPurchase.updateMany({
          where: { paymentId: payment.id },
          data: { paymentId: payment.id },
        })
        await tx.developerPlan.upsert({
          where: { userId },
          create: { userId, totalSlots: 2 + slots },
          update: { totalSlots: { increment: slots } },
        })
      })
    }

    // --- Pro subscription ---
    if (metaType === "pro") {
      const { userId } = meta
      if (!userId) return new Response("OK", { status: 200 })

      const proUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      await db.developerPlan.upsert({
        where: { userId },
        create: { userId, plan: "PRO", proUntil },
        update: { plan: "PRO", proUntil },
      })
    }

    // --- AI review ---
    if (metaType === "ai_review") {
      const { aiReviewId } = meta
      if (!aiReviewId) return new Response("OK", { status: 200 })

      await db.aiReview.updateMany({
        where: { id: aiReviewId, status: "PENDING" },
        data: { status: "PROCESSING", paymentId: payment.id },
      })
    }
  }

  if (event === "payment.canceled") {
    // Re-fetch to get authoritative metadata
    let canceledMeta: Record<string, string> = {}
    try {
      const canceledPayment = await getPayment(payment.id)
      canceledMeta = canceledPayment.metadata ?? {}
    } catch {
      canceledMeta = {}
    }

    const purchaseId = canceledMeta.purchaseId
    if (purchaseId) {
      await db.purchase.updateMany({
        where: { id: purchaseId, status: "PENDING" },
        data: { status: "REFUNDED" },
      })
    }

    const aiReviewId = canceledMeta.aiReviewId
    if (aiReviewId) {
      await db.aiReview.updateMany({
        where: { id: aiReviewId, status: "PENDING" },
        data: { status: "FAILED" },
      })
    }
  }

  return new Response("OK", { status: 200 })
}
