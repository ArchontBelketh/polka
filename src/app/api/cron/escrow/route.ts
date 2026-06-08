import { NextRequest } from "next/server"
import { releaseExpiredEscrow } from "@/lib/escrow"

// Called by a system cron (e.g. GitHub Actions scheduled workflow or server crontab)
// Requires CRON_SECRET header for protection from unauthorized calls
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret")
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const released = await releaseExpiredEscrow()
  return Response.json({ released })
}
