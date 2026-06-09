import { auth } from "@/lib/auth"
import { getPlanInfo } from "@/lib/developer-plan"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const info = await getPlanInfo(session.user.id)
  return Response.json(info)
}
