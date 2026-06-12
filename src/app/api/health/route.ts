import { db } from "@/lib/db"

// Liveness/readiness probe — used by Docker healthcheck and external uptime
// monitoring. Returns 503 if the database is unreachable.
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false }, { status: 503 })
  }
}
