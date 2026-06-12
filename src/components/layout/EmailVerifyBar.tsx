import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { VerifyBarClient } from "./VerifyBarClient"

// Thin warning bar shown to logged-in users whose email isn't verified yet.
export async function EmailVerifyBar() {
  const session = await auth()
  if (!session?.user?.id) return null

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true },
  })
  // No bar for Telegram-only accounts or already-verified users
  if (!user || user.email === null || user.emailVerified) return null

  return <VerifyBarClient />
}
