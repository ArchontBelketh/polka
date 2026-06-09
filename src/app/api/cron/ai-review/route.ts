import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { runAiReview } from "@/lib/ai-review/prompt"

// Called by system cron every 5 minutes
// curl -X POST http://localhost:3000/api/cron/ai-review -H "x-cron-secret: $CRON_SECRET"
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret")
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const pending = await db.aiReview.findMany({
    where: { status: "PROCESSING" },
    take: 5, // process up to 5 per run
    orderBy: { createdAt: "asc" },
  })

  const results = await Promise.allSettled(
    pending.map(async (review) => {
      const result = await runAiReview(review.productId)
      if (result) {
        await db.aiReview.update({
          where: { id: review.id },
          data: { status: "DONE", result: result as object, completedAt: new Date() },
        })
        return { id: review.id, status: "DONE" }
      } else {
        await db.aiReview.update({
          where: { id: review.id },
          data: { status: "FAILED" },
        })
        return { id: review.id, status: "FAILED" }
      }
    }),
  )

  const processed = results.map((r) => (r.status === "fulfilled" ? r.value : { status: "error" }))
  return Response.json({ processed })
}
