import { NextRequest } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { slugify as generateSlug } from "@/lib/slugify"
import { getCurrentUser } from "@/lib/current-user"
import { canManageCode, isStaff } from "@/lib/permissions"
import { parseCatalogQuery, catalogWhere, catalogOrderBy } from "@/lib/catalog-query"
import { productSpecificationSchema, specificationData } from "@/lib/product-specification"
import { submissionFingerprint } from "@/lib/submission-fingerprint"
import { createProductSubmission, SubmissionConflict } from "@/lib/product-submissions"

const createSchema = z.object({
  submissionId: z.string().uuid().optional(),
  title: z.string().trim().min(5).max(120),
  shortDesc: z.string().trim().min(10).max(300),
  fullDesc: z.string().trim().min(30).max(50000),
  category: z.enum(["TELEGRAM", "PARSER", "EXCEL", "AUTOMATION", "WEB"]),
  price: z.number().int().positive().max(2_147_483_647),
  features: z.array(z.string().trim().min(1).max(1000)).min(1).max(20),
  installGuide: z.string().min(200, "Инструкция по установке обязательна (минимум 200 символов)").max(20000),
  requirements: z.array(z.string().min(1).max(100)).max(15).default([]),
  targetAudience: z.string().max(300).optional(),
  techStack: z.array(z.string().max(50)).max(10).default([]),
  license: z.string().trim().min(1).max(100).default("personal"),
  specification: productSpecificationSchema.optional(),
  telegramBotUsername: z.string().max(100).optional(),
  developerPaymentInfo: z.string().max(2000).optional(),
  demoUrl: z.string().url().optional().or(z.literal("")),
  videoUrl: z.string().url().optional().or(z.literal("")),
  exampleInput: z.string().max(5000).optional(),
  exampleOutput: z.string().max(5000).optional(),
  xrayDeclInternet: z.boolean().optional(),
  xrayDeclFiles: z.boolean().optional(),
  xrayDeclCommands: z.boolean().optional(),
}).strict()
const statusSchema = z.enum(["DRAFT", "PENDING", "SCAN_FAILED", "APPROVED", "REJECTED", "SUSPENDED"])

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const parsed = parseCatalogQuery(params)
  if (!parsed.success) return Response.json({ error: parsed.error }, { status: 400 })
  const limitValue = params.getAll("limit")
  const limit = limitValue.length ? Number(limitValue[0]) : 20
  if (limitValue.length > 1 || (limitValue.length && !/^\d+$/.test(limitValue[0])) || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    return Response.json({ error: "Размер страницы должен быть от 1 до 50" }, { status: 400 })
  }
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  const requestedStatus = params.get("status")
  const status = isStaff(role) && requestedStatus ? statusSchema.safeParse(requestedStatus) : { success: true as const, data: "APPROVED" as const }
  if (!status.success) return Response.json({ error: "Неизвестный статус товара" }, { status: 400 })
  const query = parsed.value
  const where = catalogWhere(query, status.data)
  try {
    const [products, total] = await Promise.all([
      db.product.findMany({
        where, skip: (query.page - 1) * limit, take: limit, orderBy: catalogOrderBy(query),
        select: {
          id: true, slug: true, title: true, shortDesc: true, category: true, price: true,
          rating: true, reviewCount: true, salesCount: true, screenshots: true, status: true,
          techStack: true, license: true, manuallyVerified: true,
          specification: { select: { languages: true, platforms: true, compatibility: true, outcome: true, supportTerms: true, updateTerms: true } },
          author: { select: { id: true, name: true, telegramHandle: true } },
        },
      }),
      db.product.count({ where }),
    ])
    return Response.json({ products, total, page: query.page, limit })
  } catch {
    return Response.json({ error: "Не удалось загрузить каталог. Попробуйте позже." }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: "Необходима авторизация" }, { status: 401 })
  if (!canManageCode(user.role)) return Response.json({ error: "Только разработчики могут публиковать продукты" }, { status: 403 })
  let body: unknown
  try { body = await req.json() } catch { return Response.json({ error: "Некорректный JSON" }, { status: 400 }) }
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  const { submissionId, ...payload } = parsed.data
  const { title, demoUrl, videoUrl, specification, ...rest } = payload
  const slug = generateSlug(title)
  const data = {
      ...rest, title, slug, screenshots: [], authorId: user.id, status: "DRAFT" as const,
      demoUrl: demoUrl || null, videoUrl: videoUrl || null,
      ...(specification ? { specification: { create: specificationData(specification) } } : {}),
  }
  try {
    if (!submissionId) return Response.json(await db.product.create({ data }), { status: 201 })
    const result = await createProductSubmission(user.id, submissionId, submissionFingerprint(payload), data)
    return Response.json(result.product, { status: result.created ? 201 : 200 })
  } catch (error) {
    if (error instanceof SubmissionConflict) return Response.json({ error: error.message, productId: error.productId, code: "SUBMISSION_CHANGED" }, { status: 409 })
    throw error
  }
}
