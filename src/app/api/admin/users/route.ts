import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (user?.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim() ?? ""
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const take = 50

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
          { telegramHandle: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {}

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip: (page - 1) * take,
      select: {
        id: true,
        email: true,
        name: true,
        telegramHandle: true,
        role: true,
        isBanned: true,
        bannedAt: true,
        banReason: true,
        createdAt: true,
        _count: { select: { products: true, purchases: true } },
      },
    }),
    db.user.count({ where }),
  ])

  return Response.json({ users, total, page, pages: Math.ceil(total / take) })
}
