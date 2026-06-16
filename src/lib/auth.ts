import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { z } from "zod"
import { verifyTelegramAuth, type TelegramUser } from "@/lib/telegram-auth"

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  // Явно задаём секрет: NextAuth v5 в проде ищет AUTH_SECRET, а у нас он лежит
  // как NEXTAUTH_SECRET (имя из v4). Без этого — ошибка "server configuration".
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  // За nginx-прокси нужно доверять Host/X-Forwarded-* заголовкам, иначе v5
  // отклоняет запрос как UntrustedHost.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await db.user.findUnique({
          where: { email: parsed.data.email.trim().toLowerCase() },
        })

        if (!user?.passwordHash) return null

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
    Credentials({
      id: "telegram",
      credentials: {
        id: {},
        first_name: {},
        last_name: {},
        username: {},
        photo_url: {},
        auth_date: {},
        hash: {},
      },
      async authorize(credentials) {
        const tgUser = credentials as unknown as TelegramUser
        if (!verifyTelegramAuth(tgUser)) return null

        const telegramId = String(tgUser.id)
        const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ")

        let user = await db.user.findUnique({ where: { telegramId } })
        if (!user) {
          user = await db.user.create({
            data: {
              telegramId,
              telegramHandle: tgUser.username ?? null,
              name,
              role: "BUYER",
              agreedToTerms: true,
              agreedAt: new Date(),
            },
          })
        }

        return { id: user.id, name: user.name, email: user.email, role: user.role }
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.id) return true
      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: { isBanned: true },
      })
      if (dbUser?.isBanned) return false
      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        // @ts-expect-error role is added in authorize
        token.role = user.role
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        // @ts-expect-error role is in token
        session.user.role = token.role
      }
      return session
    },
  },
})
