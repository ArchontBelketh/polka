import type { PrismaClient } from "@/generated/prisma/client"
import { createDatabase, configuredDatabaseProvider } from "./database-factory"

export const databaseProvider = configuredDatabaseProvider()

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db = globalForPrisma.prisma ?? createDatabase()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
