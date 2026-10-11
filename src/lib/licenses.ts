// Типы лицензий продуктов: две — «Личная» и «Коммерческая», у каждой стандартный текст.
export type LicenseType = "personal" | "commercial"

// Ярлыки (legacy "team" трактуем как коммерческую).
export const LICENSE_LABELS: Record<string, string> = {
  personal: "Личная",
  commercial: "Коммерческая",
  team: "Коммерческая",
}

// Варианты для форм (сабмит/редактор).
export const LICENSE_OPTIONS = [
  { value: "personal", label: "Личная — для собственных проектов" },
  { value: "commercial", label: "Коммерческая — для проектов клиентов" },
] as const

// Стандартный текст лицензии, показывается покупателю.
export const LICENSE_TEXT: Record<string, string> = {
  personal:
    "Личная лицензия: покупатель вправе использовать продукт в собственных проектах. " +
    "Перепродажа, передача третьим лицам и распространение исходного кода не допускаются.",
  commercial:
    "Коммерческая лицензия: покупатель вправе использовать продукт, в том числе в проектах своих " +
    "клиентов. Перепродажа самого продукта как отдельного товара не допускается.",
}

export function licenseLabel(license: string): string {
  return LICENSE_LABELS[license] ?? license
}

export function licenseText(license: string): string {
  return LICENSE_TEXT[license] ?? LICENSE_TEXT.personal
}

// Открытые лицензии. Если упомянуты в описании/файлах, а продаётся по «Личной» —
// это конфликт: открытая лицензия разрешает покупателю свободно распространять код.
const OPEN_LICENSE_RE =
  /\b(MIT|Apache(?:[\s-]?2\.0| License)|GPL(?:\s?v?[23])?|LGPL|AGPL|BSD(?:[\s-]?(?:2|3)(?:-Clause)?)?|ISC|MPL(?:[\s-]?2\.0)?|Mozilla Public License|Unlicense|CC0)\b/i

/** Возвращает название открытой лицензии, если нашлось в тексте, иначе null. */
export function detectOpenLicense(text: string): string | null {
  const m = text.match(OPEN_LICENSE_RE)
  return m ? m[0] : null
}
