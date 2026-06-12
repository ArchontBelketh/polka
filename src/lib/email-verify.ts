import crypto from "crypto"
import { db } from "@/lib/db"
import { notifyEmailVerification } from "@/lib/notify"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

export const EMAIL_NOT_VERIFIED_MESSAGE =
  "Подтвердите email, чтобы оставлять отзывы и задавать вопросы. Письмо отправлено при регистрации."

/** True if the user's email is confirmed (or the account has no email, e.g. Telegram-only). */
export async function isEmailVerified(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true, email: true },
  })
  // Telegram-only accounts (no email) aren't gated on email verification
  return !!user && (user.email === null || user.emailVerified !== null)
}

/** Generates a verification token, stores its hash, and emails the link. */
export async function issueEmailVerification(userId: string, email: string): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex")
  const hash = crypto.createHash("sha256").update(token).digest("hex")
  await db.user.update({ where: { id: userId }, data: { emailVerifyTokenHash: hash } })
  void notifyEmailVerification(email, `${APP_URL}/verify/${token}`)
}
