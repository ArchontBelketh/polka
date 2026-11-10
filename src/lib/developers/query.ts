import { z } from "zod"
import type { Prisma } from "@/generated/prisma/client"

const filters = z.object({
  q: z.string().trim().max(120).default(""),
  skill: z.string().trim().max(40).default(""),
  specialization: z.enum(["ONE_C", "BOTS", "INTEGRATIONS", "SCRIPTS", "WEB"]).optional(),
  availability: z.enum(["READY", "AVAILABLE", "LIMITED", "ALL"]).default("READY"),
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(10000)).default(1),
})
export type DeveloperQuery = z.infer<typeof filters>
export function parseDeveloperQuery(input: URLSearchParams | Record<string, string | string[] | undefined>) {
  const raw: Record<string, string> = {}
  for (const key of ["q", "skill", "specialization", "availability", "page"]) {
    const values = input instanceof URLSearchParams ? input.getAll(key) : input[key]
    if (Array.isArray(values) && values.length > 1) return { success: false as const, error: "Каждый фильтр указывается один раз" }
    const value = Array.isArray(values) ? values[0] : values
    if (value?.trim()) raw[key] = value.trim()
  }
  const parsed = filters.safeParse(raw)
  return parsed.success ? { success: true as const, value: parsed.data } : { success: false as const, error: parsed.error.issues[0].message }
}
export function developerWhere(value: DeveloperQuery): Prisma.DeveloperListingWhereInput {
  return { enabled: true, user: { isBanned: false, role: { in: ["DEVELOPER", "ADMIN"] },
    developerProfile: {
      headline: { not: null },
      ...(value.availability === "ALL" ? {} : { availability: value.availability === "READY" ? { in: ["AVAILABLE", "LIMITED"] } : value.availability }),
      ...(value.specialization ? { specializations: { has: value.specialization } } : {}),
      // Skills are exact tags; q searches the public name and headline only.
      ...(value.skill ? { skills: { has: value.skill } } : {}),
    },
    ...(value.q ? { OR: [{ name: { contains: value.q, mode: "insensitive" } }, { developerProfile: { headline: { contains: value.q, mode: "insensitive" } } }] } : {}),
  } }
}
