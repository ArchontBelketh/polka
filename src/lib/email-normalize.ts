/**
 * Каноникализация email для защиты от спам-регистраций «одним ящиком».
 *
 * Gmail игнорирует точки в локальной части и всё после «+», поэтому
 * a.b.c@gmail.com, abc@gmail.com и abc+bot1@gmail.com — это ОДИН ящик, но в
 * БД без нормализации каждый уникален. Боты этим пользуются, чтобы наплодить
 * сотни аккаунтов. Приводим адрес к каноническому виду, чтобы уникальный
 * индекс по email ловил такие дубли.
 *
 * googlemail.com — исторический алиас gmail.com, схлопываем к нему же.
 */
const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"])

export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase()
  const at = email.lastIndexOf("@")
  if (at < 0) return email

  let local = email.slice(0, at)
  let domain = email.slice(at + 1)

  if (GMAIL_DOMAINS.has(domain)) {
    local = local.split("+")[0].replace(/\./g, "")
    domain = "gmail.com"
  }
  return `${local}@${domain}`
}
