import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET — number of unread messages addressed to the current user
// (messages they did not send, in threads where they are buyer or product author)
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ count: 0 })
  }
  const userId = session.user.id

  const count = await db.purchaseMessage.count({
    where: {
      isRead: false,
      senderId: { not: userId },
      purchase: {
        OR: [{ buyerId: userId }, { product: { authorId: userId } }],
      },
    },
  })

  return Response.json({ count })
}
