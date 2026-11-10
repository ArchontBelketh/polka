import { z } from "zod"
import type { Prisma } from "@/generated/prisma/client"
import { priceInKopecks } from "@/lib/catalog-query"

export const publicJobSelect = {
  id: true, title: true, description: true, outcome: true, specialization: true,
  budgetMin: true, budgetMax: true, deadline: true, status: true, publishedAt: true,
  customer: { select: { id: true, name: true } },
} satisfies Prisma.JobSelect
export const publicJobsWhere = { publicationStatus: "APPROVED", customer: { isBanned: false } } satisfies Prisma.JobWhereInput
const money = z.string().refine(value => priceInKopecks(value) !== null, "Укажите сумму в рублях с точностью до копеек")
const filters = z.object({
  q: z.string().trim().max(140).optional(), specialization: z.enum(["ONE_C", "BOTS", "INTEGRATIONS", "SCRIPTS", "WEB"]).optional(),
  status: z.enum(["OPEN", "EXECUTOR_SELECTED", "IN_PROGRESS", "ACCEPTANCE", "COMPLETED", "CANCELLED", "DISPUTED", "ALL"]).default("OPEN"),
  minBudget: money.optional(), maxBudget: money.optional(),
  deadlineBefore: z.iso.date({ error: "Укажите корректную дату" }).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(10000)).default(1),
}).refine(value => !value.minBudget || !value.maxBudget || priceInKopecks(value.minBudget)! <= priceInKopecks(value.maxBudget)!, "Бюджет «от» превышает «до»")
export function parseJobQuery(input: URLSearchParams | Record<string, string | string[] | undefined>) {
  const raw: Record<string, string> = {}
  for (const key of ["q", "specialization", "status", "minBudget", "maxBudget", "deadlineBefore", "page"]) {
    const values = input instanceof URLSearchParams ? input.getAll(key) : input[key]
    if (Array.isArray(values) && values.length > 1) return { success: false as const, error: "Каждый фильтр указывается один раз" }
    const value = Array.isArray(values) ? values[0] : values
    if (value?.trim()) raw[key] = value.trim()
  }
  const parsed = filters.safeParse(raw)
  return parsed.success ? { success: true as const, value: parsed.data } : { success: false as const, error: parsed.error.issues[0].message }
}
export function jobCatalogWhere(value: z.infer<typeof filters>): Prisma.JobWhereInput {
  return { ...publicJobsWhere,
    ...(value.status !== "ALL" ? { status: value.status } : {}),
    ...(value.specialization ? { specialization: value.specialization } : {}),
    ...(value.q ? { OR: [{ title: { contains: value.q, mode: "insensitive" } }, { description: { contains: value.q, mode: "insensitive" } }, { outcome: { contains: value.q, mode: "insensitive" } }] } : {}),
    ...(value.minBudget ? { budgetMax: { gte: priceInKopecks(value.minBudget)! } } : {}),
    ...(value.maxBudget ? { budgetMin: { lte: priceInKopecks(value.maxBudget)! } } : {}),
    ...((value.status === "OPEN" || value.deadlineBefore) ? { deadline: { ...(value.status === "OPEN" ? { gt: new Date() } : {}), ...(value.deadlineBefore ? { lte: new Date(`${value.deadlineBefore}T23:59:59.999Z`) } : {}) } } : {}),
  }
}
