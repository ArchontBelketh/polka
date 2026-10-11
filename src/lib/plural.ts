// Русские склонения через Intl.PluralRules — корректны для 1, 2, 5, 11, 21, 22, 25.
const RU = new Intl.PluralRules("ru-RU")

export interface PluralForms {
  one: string // 1, 21, 31…
  few: string // 2–4, 22–24…
  many: string // 0, 5–20, 25–30…
}

/** Возвращает нужную форму слова без числа. */
export function plural(n: number, forms: PluralForms): string {
  const cat = RU.select(Math.abs(n))
  if (cat === "one") return forms.one
  if (cat === "few") return forms.few
  return forms.many
}

/** «3 продажи», «21 продажа», «25 продаж». */
export function pluralize(n: number, forms: PluralForms): string {
  return `${n} ${plural(n, forms)}`
}

// Готовые наборы форм для частых счётчиков.
export const FORMS = {
  sale: { one: "продажа", few: "продажи", many: "продаж" },
  sales: { one: "продажа", few: "продажи", many: "продаж" }, // alias
  product: { one: "продукт", few: "продукта", many: "продуктов" },
  review: { one: "отзыв", few: "отзыва", many: "отзывов" },
  developer: { one: "разработчик", few: "разработчика", many: "разработчиков" },
  spot: { one: "место", few: "места", many: "мест" },
} satisfies Record<string, PluralForms>

const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
]

/** «июня 2026 г.» — месяц в родительном падеже (для «на ПОЛКЕ с …»). */
export function monthYearGenitive(date: Date): string {
  return `${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()} г.`
}
