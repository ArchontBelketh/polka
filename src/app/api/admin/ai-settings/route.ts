import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) return null
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  return user?.role === "ADMIN" ? session : null
}

const schema = z.object({
  provider: z.enum(["disabled", "gemini", "yandexgpt"]),
  model: z.string().trim().max(100).optional(),
  folderId: z.string().trim().max(100).optional(),
  apiKey: z.string().trim().max(500).optional(),
})

export async function GET() {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 })
  const row = await db.aiSettings.findUnique({ where: { id: "singleton" } })
  // Ключ наружу НЕ отдаём — только признак, что он задан.
  return Response.json({
    provider: row?.provider ?? "disabled",
    model: row?.model ?? "",
    folderId: row?.folderId ?? "",
    hasKey: !!row?.apiKey,
  })
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }
  const { provider, model, folderId, apiKey } = parsed.data

  const base = { provider, model: model || null, folderId: folderId || null }
  await db.aiSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...base, apiKey: apiKey || null },
    // Пустой apiKey при обновлении = не менять сохранённый ключ.
    update: { ...base, ...(apiKey ? { apiKey } : {}) },
  })
  return Response.json({ ok: true })
}
