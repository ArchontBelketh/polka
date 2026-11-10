import { z } from "zod"

export const PRODUCT_LANGUAGES = {
  PYTHON: "Python", JAVASCRIPT: "JavaScript", TYPESCRIPT: "TypeScript", ONE_C: "1С",
  VBA: "VBA", CSHARP: "C#", JAVA: "Java", PHP: "PHP", GO: "Go", RUST: "Rust", SQL: "SQL", OTHER: "Другой язык",
} as const

export const PRODUCT_PLATFORMS = {
  WINDOWS: "Windows", LINUX: "Linux", MACOS: "macOS", WEB: "Браузер", TELEGRAM: "Telegram", ONE_C: "1С", EXCEL: "Excel",
} as const

export const languageSchema = z.enum(["PYTHON", "JAVASCRIPT", "TYPESCRIPT", "ONE_C", "VBA", "CSHARP", "JAVA", "PHP", "GO", "RUST", "SQL", "OTHER"])
export const platformSchema = z.enum(["WINDOWS", "LINUX", "MACOS", "WEB", "TELEGRAM", "ONE_C", "EXCEL"])
const unique = <T>(values: T[]) => [...new Set(values)]

export const productSpecificationSchema = z.object({
  languages: z.array(languageSchema).max(5).default([]).transform(unique),
  platforms: z.array(platformSchema).max(7).default([]).transform(unique),
  compatibility: z.string().trim().max(2000).default(""),
  outcome: z.string().trim().max(2000).default(""),
  supportTerms: z.string().trim().max(2000).default(""),
  updateTerms: z.string().trim().max(2000).default(""),
}).strict()

export type ProductSpecificationInput = z.infer<typeof productSpecificationSchema>
export type SpecificationRecord = {
  languages: string[]; platforms: string[]; compatibility: string | null;
  outcome: string | null; supportTerms: string | null; updateTerms: string | null;
}

export function specificationInput(record?: SpecificationRecord | null): ProductSpecificationInput {
  return {
    languages: (record?.languages ?? []).filter((value): value is keyof typeof PRODUCT_LANGUAGES => Object.hasOwn(PRODUCT_LANGUAGES, value)),
    platforms: (record?.platforms ?? []).filter((value): value is keyof typeof PRODUCT_PLATFORMS => Object.hasOwn(PRODUCT_PLATFORMS, value)),
    compatibility: record?.compatibility ?? "", outcome: record?.outcome ?? "",
    supportTerms: record?.supportTerms ?? "", updateTerms: record?.updateTerms ?? "",
  }
}

export function specificationData(input: ProductSpecificationInput) {
  return {
    ...input, compatibility: input.compatibility || null, outcome: input.outcome || null,
    supportTerms: input.supportTerms || null, updateTerms: input.updateTerms || null,
  }
}

export const EDITABLE_SPECIFICATION_STATUSES = ["DRAFT", "REJECTED", "SCAN_FAILED"] as const
