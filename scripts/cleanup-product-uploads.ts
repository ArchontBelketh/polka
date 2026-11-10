import "./ydb/env"

async function main() {
  if (process.argv.includes("--help")) { console.log("Usage: npm run uploads:cleanup [-- --apply]. Default: read-only plan, up to 100 attempts older than 24 hours. Only staging/ objects are deleted."); return }
  if (process.argv.slice(2).some((arg) => arg !== "--apply")) throw new Error("Unknown option. Use --help.")
  const { cleanupProductUploads } = await import("../src/lib/product-upload-cleanup")
  const { db } = await import("../src/lib/db")
  try { console.log(JSON.stringify(await cleanupProductUploads({ apply: process.argv.includes("--apply") }))) }
  finally { await db.$disconnect() }
}
main().catch(() => { console.error("Upload cleanup did not finish. Check database/storage access; no artifact keys are cleanup targets."); process.exitCode = 1 })
