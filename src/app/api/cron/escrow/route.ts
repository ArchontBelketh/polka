import { NextRequest } from "next/server"
import { releaseExpiredEscrow } from "@/lib/escrow"

// Called by a system cron (e.g. GitHub Actions scheduled workflow or server crontab)
// Requires CRON_SECRET header for protection from unauthorized calls
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

  const released = await releaseExpiredEscrow()
  return Response.json({ released })
}
