import "./ydb/env"

async function main() {
  if (process.argv.includes("--help")) { console.log("Usage: npx tsx scripts/cleanup-exposure-events.ts [--apply]. Default: read-only plan. At most 1000 ExposureEvent rows older than 31 days per run."); return }
  if (process.argv.slice(2).some(arg => arg !== "--apply")) throw new Error("Unknown option. Use --help.")
  const { cleanupExposureEvents } = await import("../src/lib/developers/cleanup")
  const { db } = await import("../src/lib/db")
  try { console.log(JSON.stringify(await cleanupExposureEvents({ apply: process.argv.includes("--apply") }))) }
  finally { await db.$disconnect() }
}
main().catch(() => { console.error("Exposure cleanup did not finish. Check database access."); process.exitCode = 1 })
