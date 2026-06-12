import { db } from "@/lib/db"

/**
 * Records that a cron job ran. `scripts/monitor.sh` reads `CronHeartbeat`
 * and alerts if a job hasn't checked in within its expected window.
 * Best-effort: never throws (a heartbeat failure must not fail the job).
 */
export async function recordCronRun(job: string): Promise<void> {
  try {
    await db.cronHeartbeat.upsert({
      where: { job },
      create: { job, ranAt: new Date() },
      update: { ranAt: new Date() },
    })
  } catch {
    // ignore — heartbeat is monitoring only
  }
}
