import { z } from "zod"

// Shared specializations for profiles and the forthcoming jobs section.
// Existing product categories are kept separately and retain their identifiers.
export const SPECIALIZATIONS = {
  ONE_C: "1С",
  BOTS: "Боты",
  INTEGRATIONS: "Интеграции",
  SCRIPTS: "Скрипты и автоматизация",
  WEB: "Веб-разработка",
} as const

export const AVAILABILITY_LABELS = {
  AVAILABLE: "Открыт к предложениям",
  LIMITED: "Ограниченная доступность",
  UNAVAILABLE: "Сейчас не беру заказы",
} as const

export type Availability = keyof typeof AVAILABILITY_LABELS
export type Specialization = keyof typeof SPECIALIZATIONS

const publicUrl = z.string().trim().max(500).url("Укажите полный HTTPS-адрес")
  .refine((value) => {
    try {
      const url = new URL(value)
      return url.protocol === "https:" && !!url.hostname && !url.username && !url.password
    } catch { return false }
  }, "Ссылка должна начинаться с https:// и не содержать логин или пароль")

export const portfolioItemSchema = z.object({
  title: z.string().trim().min(2, "Добавьте название проекта").max(100),
  description: z.string().trim().max(600),
  url: z.union([z.literal(""), publicUrl]),
}).strict()

export const developerProfileSchema = z.object({
  listed: z.boolean().optional(),
  headline: z.string().trim().max(120),
  skills: z.array(z.string().trim().min(1).max(40)).max(20)
    .transform((items) => items.filter((item, index) => items.findIndex((other) => other.toLocaleLowerCase("ru") === item.toLocaleLowerCase("ru")) === index)),
  specializations: z.array(z.enum(["ONE_C", "BOTS", "INTEGRATIONS", "SCRIPTS", "WEB"])).max(5)
    .transform((items) => [...new Set(items)]),
  availability: z.enum(["AVAILABLE", "LIMITED", "UNAVAILABLE"]),
  portfolio: z.array(portfolioItemSchema).max(6),
}).strict()

export type DeveloperProfileInput = z.infer<typeof developerProfileSchema>
export type PortfolioItem = z.infer<typeof portfolioItemSchema>

export function readPortfolio(value: unknown): PortfolioItem[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 6).flatMap((item) => {
    const result = portfolioItemSchema.safeParse(item)
    return result.success ? [result.data] : []
  })
}
