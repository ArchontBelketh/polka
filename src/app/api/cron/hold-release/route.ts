import { NextRequest } from "next/server"
import { releaseExpiredHolds } from "@/lib/earnings"
import { recordCronRun } from "@/lib/cron-heartbeat"

// Зачисляет удержанные суммы (≥ порога) по продажам с истёкшим окном претензии.
// Вызывается системным cron. curl -X POST .../api/cron/hold-release -H "x-cron-secret: $CRON_SECRET"
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || cronSecret.length < 32) {
    console.error("CRON_SECRET is not set or too short — cron endpoint is disabled")
    return Response.json({ error: "Service unavailable" }, { status: 503 })
  }
  const secret = req.headers.get("x-cron-secret")
  if (!secret || secret !== cronSecret) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const released = await releaseExpiredHolds()
  await recordCronRun("hold-release")
  return Response.json({ released })
}
