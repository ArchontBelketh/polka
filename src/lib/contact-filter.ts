/**
 * Detects attempts to exchange contact details in on-platform text
 * (pre-purchase Q&A and the private buyer↔developer chat after purchase).
 * The goal is to keep deals on the platform: users must not swap
 * phone/email/messenger handles to take the transaction elsewhere.
 *
 * Besides the plain patterns, we defend against the common evasions:
 *  - spelled-out separators ("точка", "собака", "at", "слэш");
 *  - digits/letters spread apart with spaces ("8 9 2 1 …", "j o h n @ …");
 *  - a phone number written fully in words ("восемь девятьсот …").
 */

const CONTACT_PATTERNS: RegExp[] = [
  /(\+7|\b8)[\s(-]?\d{3}[\s)-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/, // Russian phone
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, // email
  /t\.me\/[a-z0-9_]+/i, // telegram link
  /@[a-z0-9_]{5,}/i, // telegram-style handle
  /(wa\.me|whatsapp|viber|vk\.com|vk\.me|t\.me)/i, // other messengers / VK
]

// Russian number words — a phone spelled out ("восемь девятьсот двадцать
// один …") would otherwise slip past the digit patterns. Enough of these in
// one message is a strong signal of a disguised phone number.
const NUMBER_WORDS = [
  "ноль", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь",
  "девять", "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать",
  "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать",
  "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят",
  "восемьдесят", "девяносто", "сто", "двести", "триста", "четыреста",
  "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот",
]
// \b в JS опирается на ASCII \w и не работает с кириллицей — используем
// юникод-lookaround, иначе границы русских слов не срабатывают.
const NUMBER_WORD_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${NUMBER_WORDS.join("|")})(?![\\p{L}\\p{N}])`,
  "giu",
)
const NUMBER_WORD_THRESHOLD = 7 // ~длина телефона; ниже слишком много ложных

export const CONTACT_BLOCK_MESSAGE =
  "Обмен контактами запрещён правилами платформы. Уберите телефон, email или ссылки на мессенджеры — общайтесь через площадку."

/** Replaces spelled-out separators with their symbols to unmask obfuscation. */
function deobfuscate(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\s(\[{]*(?<![\p{L}\p{N}])(?:точк[аи]|тчк|dot)(?![\p{L}\p{N}])[\s)\]}]*/gu, ".")
    .replace(/[\s(\[{]*(?<![\p{L}\p{N}])(?:собач?ка|at)(?![\p{L}\p{N}])[\s)\]}]*/gu, "@")
    .replace(/[\s(\[{]*(?<![\p{L}\p{N}])(?:сл[эе]ш|slash)(?![\p{L}\p{N}])[\s)\]}]*/gu, "/")
}

/** Returns true if the text appears to contain contact details. */
export function containsContactInfo(text: string): boolean {
  const deob = deobfuscate(text)
  // Убираем пробелы: ловит разнесённые по буквам/цифрам контакты
  // ("8 9 2 1 …", "j o h n @ g m a i l . c o m").
  const tight = deob.replace(/\s+/g, "")

  if (CONTACT_PATTERNS.some((re) => re.test(deob) || re.test(tight))) {
    return true
  }

  // Телефон, записанный словами.
  const numberWords = text.match(NUMBER_WORD_RE)
  if (numberWords && numberWords.length >= NUMBER_WORD_THRESHOLD) {
    return true
  }

  return false
}
