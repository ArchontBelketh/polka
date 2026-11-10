import { z } from "zod"
import type { Prisma, ProductStatus } from "@/generated/prisma/client"
import { languageSchema, platformSchema } from "@/lib/product-specification"

export const CATALOG_SORT_OPTIONS = [
  { value: "popular", label: "Популярные" }, { value: "newest", label: "Новые" },
  { value: "rating", label: "По рейтингу" }, { value: "price_asc", label: "Дешевле" }, { value: "price_desc", label: "Дороже" },
] as const
export const CATALOG_KEYS = ["category", "q", "sort", "minPrice", "maxPrice", "language", "platform", "compatibility", "license", "page"] as const
export type CatalogSearchParams = Record<string, string | string[] | undefined>

export function priceInKopecks(value: string): number | null {
  if (!/^\d{1,8}(?:[.,]\d{1,2})?$/.test(value)) return null
  const [rubles, cents = ""] = value.replace(",", ".").split(".")
  const amount = Number(rubles) * 100 + Number(cents.padEnd(2, "0"))
  return amount <= 2_147_483_647 ? amount : null
}
const money = z.string().refine((value) => priceInKopecks(value) !== null, "Цена должна быть неотрицательным числом с точностью до копеек")
  .transform((value) => String(priceInKopecks(value)! / 100))
const querySchema = z.object({
  category: z.enum(["TELEGRAM", "PARSER", "EXCEL", "AUTOMATION", "WEB"]).optional(),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(["popular", "newest", "rating", "price_asc", "price_desc"]).default("popular"),
  minPrice: money.optional(), maxPrice: money.optional(),
  language: languageSchema.optional(), platform: platformSchema.optional(),
  compatibility: z.string().trim().max(200).optional(),
  license: z.enum(["personal", "commercial", "other"]).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(10000)).default(1),
}).refine((value) => value.minPrice === undefined || value.maxPrice === undefined || priceInKopecks(value.minPrice)! <= priceInKopecks(value.maxPrice)!, "Цена «от» не должна превышать цену «до»")

export type CatalogQuery = z.infer<typeof querySchema>

export function parseCatalogQuery(input: CatalogSearchParams | URLSearchParams): { success: true; value: CatalogQuery } | { success: false; error: string } {
  const raw: Record<string, string> = {}
  for (const key of CATALOG_KEYS) {
    const values = input instanceof URLSearchParams ? input.getAll(key) : input[key]
    if (Array.isArray(values) && values.length > 1) return { success: false, error: "Каждый фильтр должен быть указан один раз" }
    const value = Array.isArray(values) ? values[0] : values
    if (typeof value === "string" && value.trim()) raw[key] = value.trim()
  }
  const result = querySchema.safeParse(raw)
  if (!result.success) {
    const issue = result.error.issues[0]
    const messages: Record<string, string> = {
      category: "Выберите существующую категорию", language: "Выберите язык из списка",
      platform: "Выберите платформу из списка", license: "Выберите лицензию из списка",
      sort: "Выберите сортировку из списка", page: "Номер страницы должен быть целым числом от 1 до 10000",
      q: "Поисковый запрос не должен превышать 200 символов", compatibility: "Запрос совместимости не должен превышать 200 символов",
    }
    return { success: false, error: issue?.code === "custom" ? issue.message : messages[String(issue?.path[0])] ?? "Проверьте фильтры каталога" }
  }
  return { success: true, value: result.data }
}

export function catalogWhere(query: CatalogQuery, status: ProductStatus = "APPROVED"): Prisma.ProductWhereInput {
  const specification: Prisma.ProductSpecificationWhereInput = {
    ...(query.language ? { languages: { has: query.language } } : {}),
    ...(query.platform ? { platforms: { has: query.platform } } : {}),
    ...(query.compatibility ? { compatibility: { contains: query.compatibility, mode: "insensitive" } } : {}),
  }
  return {
    status,
    ...(query.category ? { category: query.category } : {}),
    ...(query.q ? { OR: [{ title: { contains: query.q, mode: "insensitive" } }, { shortDesc: { contains: query.q, mode: "insensitive" } }] } : {}),
    ...(query.minPrice !== undefined || query.maxPrice !== undefined ? { price: {
      ...(query.minPrice !== undefined ? { gte: priceInKopecks(query.minPrice)! } : {}),
      ...(query.maxPrice !== undefined ? { lte: priceInKopecks(query.maxPrice)! } : {}),
    } } : {}),
    ...(Object.keys(specification).length ? { specification: { is: specification } } : {}),
    ...(query.license === "personal" ? { license: "personal" } : query.license === "commercial" ? { license: { in: ["commercial", "team"] } } : query.license === "other" ? { license: { notIn: ["personal", "commercial", "team"] } } : {}),
  }
}

export function catalogOrderBy(query: CatalogQuery): Prisma.ProductOrderByWithRelationInput[] {
  const orders: Record<CatalogQuery["sort"], Prisma.ProductOrderByWithRelationInput[]> = {
    popular: [{ manuallyVerified: "desc" }, { salesCount: "desc" }], newest: [{ publishedAt: "desc" }],
    rating: [{ rating: "desc" }], price_asc: [{ price: "asc" }], price_desc: [{ price: "desc" }],
  }
  return [...orders[query.sort], { id: "asc" }]
}

export function catalogUrl(query: CatalogQuery, overrides: Partial<CatalogQuery> = {}) {
  const next = { ...query, ...overrides }
  const params = new URLSearchParams()
  for (const key of CATALOG_KEYS) {
    const value = next[key]
    if (value === undefined || value === "" || (key === "sort" && value === "popular") || (key === "page" && value === 1)) continue
    params.set(key, String(value))
  }
  return `/catalog${params.size ? `?${params}` : ""}`
}

export function hasCatalogFacets(query: CatalogQuery) {
  return !!(query.q || query.language || query.platform || query.compatibility || query.license || query.minPrice !== undefined || query.maxPrice !== undefined || query.sort !== "popular" || query.page > 1)
}
