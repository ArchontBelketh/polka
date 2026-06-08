import { auth } from "@/lib/auth"
import { FeedbackWidget } from "./FeedbackWidget"

export async function FeedbackWidgetWrapper() {
  const session = await auth()
  return <FeedbackWidget isLoggedIn={!!session?.user} />
}
