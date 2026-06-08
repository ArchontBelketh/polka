import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { slugify as generateSlug } from "@/lib/slugify"

const createSchema = z.object({
  title: z.string().min(5).max(120),
  shortDesc: z.string().min(10).max(300),
  fullDesc: z.string().min(30),
  category: z.enum(["TELEGRAM", "PARSER", "EXCEL", "AUTOMATION", "WEB"]),
  price: z.number().int().positive(),
  features: z.array(z.string().min(1)).min(1).max(20),
  targetAudience: z.string().optional(),
  techStack: z.array(z.string().max(50)).max(10).default([]),
  license: z.string().default("personal"),
  telegramBotUsername: z.string().optional(),
  demoUrl: z.string().url().optional().or(z.literal("")),
  videoUrl: z.string().url().optional().or(z.literal("")),
})

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const category = searchParams.get("category") ?? undefined
  const q = searchParams.get("q") ?? undefined
  const status = searchParams.get("status") ?? "APPROVED"
  const page = parseInt(searchParams.get("page") ?? "1", 10)
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50)
  const skip = (page - 1) * limit

  const where = {
    ...(category ? { category: category as never } : {}),
    ...(status ? { status: status as never } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { shortDesc: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, slug: true, title: true, shortDesc: true,
        category: true, price: true, rating: true,
        reviewCount: true, salesCount: true, screenshots: true, status: true,
        author: { select: { id: true, name: true, telegramHandle: true } },
      },
    }),
    db.product.count({ where }),
  ])

  return Response.json({ products, total, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["DEVELOPER", "ADMIN"].includes(user.role)) {
    return Response.json({ error: "Только разработчики могут публиковать продукты" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { title, demoUrl, videoUrl, ...rest } = parsed.data
  const slug = await generateSlug(title)

  const product = await db.product.create({
    data: {
      ...rest,
      title,
      slug,
      fullDesc: rest.fullDesc,
      screenshots: [],
      authorId: session.user.id,
      status: "DRAFT",
      demoUrl: demoUrl || null,
      videoUrl: videoUrl || null,
    },
  })

  return Response.json(product, { status: 201 })
}
