import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

function createPrismaClient() {
  // Pool size is configurable via DB_POOL_MAX. The local `prisma dev`
  // Postgres is unreliable beyond a single concurrent connection
  // (ECONNRESET / "Connection terminated unexpectedly"), so dev sets
  // DB_POOL_MAX=1 in .env.local. Production omits it and gets a real pool.
  const max = parseInt(process.env.DB_POOL_MAX ?? "", 10) || 10

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    max,
    keepAlive: true,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
