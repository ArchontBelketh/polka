/**
 * Allowlist для почтовых доменов при регистрации.
 *
 * Управляется переменной окружения ALLOWED_EMAIL_DOMAINS — список доменов
 * через запятую, например: "yandex.ru, gmail.com, mail.ru".
 * Пусто/не задано — разрешены любые домены.
 *
 * Поддоменка: если разрешён "yandex.ru", то "ya@mail.yandex.ru" тоже пройдёт.
 */

function parseDomains(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean)
}

/** Разрешённые домены из env. Пустой массив = ограничений нет. */
export function allowedEmailDomains(): string[] {
  return parseDomains(process.env.ALLOWED_EMAIL_DOMAINS)
}

/** Домен из адреса (часть после последней @), в нижнем регистре. */
function domainOf(email: string): string | null {
  const at = email.lastIndexOf("@")
  if (at < 0) return null
  return email.slice(at + 1).trim().toLowerCase()
}

/** true, если домен адреса разрешён (или ограничений нет). */
export function isEmailDomainAllowed(email: string): boolean {
  const allowed = allowedEmailDomains()
  if (allowed.length === 0) return true

  const domain = domainOf(email)
  if (!domain) return false

  return allowed.some(
    (a) => domain === a || domain.endsWith("." + a),
  )
}

/** Сообщение об ошибке со списком разрешённых доменов. */
export function emailDomainError(): string {
  const allowed = allowedEmailDomains()
  const list = allowed.map((d) => "@" + d).join(", ")
  return `Регистрация доступна только с почтой: ${list}`
}
