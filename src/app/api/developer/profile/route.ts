import { getCurrentUser } from "@/lib/current-user"
import { canManageCode } from "@/lib/permissions"
import { developerProfileSchema } from "@/lib/developer-profile"
import { saveDeveloperProfile } from "@/lib/developers/profile"
import { readJobJson, jobErrorResponse } from "@/lib/jobs/http"
import { rateLimit } from "@/lib/ratelimit"

export async function PUT(req: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  if (!canManageCode(user.role)) return Response.json({ error: "Сначала включите профиль разработчика" }, { status: 403 })

  let body: unknown
  if (!rateLimit(`profile:${user.id}`, 20, 60000)) return Response.json({ error: "Повторите позже" }, { status: 429 })
  try { body = await readJobJson(req) } catch (error) { return jobErrorResponse(error) }
  const parsed = developerProfileSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Проверьте поля профиля" }, { status: 422 })

  // The owner comes exclusively from the session; identity, role, ratings and
  // balances are never accepted from this public-profile form.
  try {
    await saveDeveloperProfile(user.id, parsed.data)
    return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) { return jobErrorResponse(error) }
}
