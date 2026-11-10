import "server-only"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// auth() validates JWT revocation; this fresh projection checks the current role
// and ban again next to the data operation. Never return credentials to a client.
export async function getCurrentUser() {
  const session = await auth()
  if (!session?.user?.id) return null
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, name: true, isBanned: true },
  })
  return user && !user.isBanned ? user : null
}
