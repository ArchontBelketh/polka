/**
 * Creates (or promotes) a real admin with a strong password — safe for prod.
 *
 *   npx tsx scripts/create-admin.ts --email admin@your-domain --password 'StrongPass!'
 *   npx tsx scripts/create-admin.ts --email admin@your-domain      # generates a password
 *
 * Email/password may also come from ADMIN_EMAIL / ADMIN_PASSWORD env vars.
 */
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

function arg(name: string): string | undefined {
  const withEq = process.argv.find((a) => a.startsWith(`--${name}=`))
  if (withEq) return withEq.slice(name.length + 3)
  const idx = process.argv.indexOf(`--${name}`)
  if (idx !== -1) {
    const next = process.argv[idx + 1]
    if (next && !next.startsWith("--")) return next
  }
  return undefined
}

async function main() {
  const email = (arg("email") ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error(
      "Укажите корректный email: npx tsx scripts/create-admin.ts --email admin@your-domain [--password '...']",
    )
  }

  let password = arg("password") ?? process.env.ADMIN_PASSWORD
  let generated = false
  if (!password) {
    password = crypto.randomBytes(12).toString("base64url")
    generated = true
  }
  if (password.length < 10) {
    throw new Error("Пароль слишком короткий — минимум 10 символов.")
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await db.user.upsert({
    where: { email },
    // Админ создаётся доверенным лицом из CLI — сразу помечаем почту
    // подтверждённой, чтобы не требовать верификации (и не слать письмо на
    // возможно несуществующий ящик вроде admin@<домен>).
    update: { role: "ADMIN", passwordHash, emailVerified: new Date() },
    create: {
      email,
      name: "Администратор",
      role: "ADMIN",
      passwordHash,
      emailVerified: new Date(),
      agreedToTerms: true,
      agreedAt: new Date(),
    },
  })

  console.log(`✓ Админ ${email} создан/обновлён (id ${user.id})`)
  if (generated) {
    console.log(`  Сгенерированный пароль: ${password}`)
    console.log("  Сохраните его сейчас — повторно он не будет показан.")
  }
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
  .finally(() => db.$disconnect())
