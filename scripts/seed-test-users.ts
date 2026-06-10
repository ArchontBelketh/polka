/**
 * Creates test accounts for local development.
 * Run: npx tsx scripts/seed-test-users.ts
 *
 * Accounts created:
 *   admin@polka.test     / password123  (ADMIN)
 *   dev@polka.test       / password123  (DEVELOPER)
 *   buyer@polka.test     / password123  (BUYER)
 *   moderator@polka.test / password123  (MODERATOR)
 */

import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"
import * as dotenv from "dotenv"

// tsx does not auto-load env files — load them before reading DATABASE_URL.
dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

const USERS = [
  { email: "admin@polka.test",     name: "Тест Админ",      role: "ADMIN"     as const },
  { email: "dev@polka.test",       name: "Тест Разработчик", role: "DEVELOPER" as const },
  { email: "buyer@polka.test",     name: "Тест Покупатель",  role: "BUYER"     as const },
  { email: "moderator@polka.test", name: "Тест Модератор",   role: "MODERATOR" as const },
]

async function main() {
  const hash = await bcrypt.hash("password123", 10)

  for (const u of USERS) {
    await db.user.upsert({
      where: { email: u.email },
      update: { passwordHash: hash, name: u.name, role: u.role },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash: hash,
        agreedToTerms: true,
        agreedAt: new Date(),
      },
    })
    console.log(`✓ ${u.role.padEnd(10)} ${u.email}`)
  }

  console.log("\nПароль для всех: password123")
}

main().catch(console.error).finally(() => db.$disconnect())
