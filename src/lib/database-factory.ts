import { PrismaClient } from "../generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { createYdbDatabase } from "./ydb/database"

export function configuredDatabaseProvider() {
  const provider = process.env.DB_PROVIDER || "postgresql"
  if (provider !== "postgresql" && provider !== "ydb") throw new Error("DB_PROVIDER must be postgresql or ydb")
  return provider
}

export function createDatabase(): PrismaClient {
  if (configuredDatabaseProvider() === "ydb") return createYdbDatabase()
  return new PrismaClient({ adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    max: parseInt(process.env.DB_POOL_MAX ?? "", 10) || 10,
    keepAlive: true,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  }) })
}
