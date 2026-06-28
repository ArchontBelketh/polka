import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import CyberHeader from "@/components/header/CyberHeader"

// Серверная обёртка: получает сессию и счётчик непрочитанных, отдаёт их в
// клиентскую кибер-шапку пропсами (анимация/вёрстка — в CyberHeader).
export async function Navbar() {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  const userId = session?.user?.id

  let unread = 0
  if (userId) {
    unread = await db.purchaseMessage.count({
      where: {
        isRead: false,
        senderId: { not: userId },
        purchase: { OR: [{ buyerId: userId }, { product: { authorId: userId } }] },
      },
    })
  }
  const messagesHref = role === "DEVELOPER" ? "/dashboard/messages" : "/purchases"

  return (
    <CyberHeader
      authed={!!session?.user}
      role={role}
      unread={unread}
      messagesHref={messagesHref}
    />
  )
}
