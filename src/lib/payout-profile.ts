import type { PayerKind, PayoutProfile } from "@/generated/prisma/client"

export const PAYER_KIND_LABELS: Record<PayerKind, string> = {
  SELF_EMPLOYED: "Самозанятый (НПД)",
  ENTREPRENEUR: "Индивидуальный предприниматель",
  COMPANY: "Юридическое лицо (ООО)",
}

/** Длина ИНН по типу: ЮЛ — 10 цифр, самозанятый/ИП (физлицо) — 12. */
export function innLength(kind: PayerKind): 10 | 12 {
  return kind === "COMPANY" ? 10 : 12
}

/** Проверка контрольных цифр ИНН (10 или 12 знаков). */
export function isValidInn(inn: string): boolean {
  if (!/^\d+$/.test(inn)) return false
  const d = inn.split("").map(Number)

  const check = (weights: number[], digits: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0)
    return ((sum % 11) % 10)
  }

  if (inn.length === 10) {
    return check([2, 4, 10, 3, 5, 9, 4, 6, 8], d) === d[9]
  }
  if (inn.length === 12) {
    const n11 = check([7, 2, 4, 10, 3, 5, 9, 4, 6, 8], d)
    const n12 = check([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8], d)
    return n11 === d[10] && n12 === d[11]
  }
  return false
}

/** ИНН корректен для выбранного статуса (правильная длина + контрольная сумма). */
export function isInnValidForKind(inn: string, kind: PayerKind): boolean {
  return inn.length === innLength(kind) && isValidInn(inn)
}

/** Профиль заполнен настолько, что разработчику можно публиковать продукт. */
export function isProfileComplete(profile: PayoutProfile | null | undefined): boolean {
  if (!profile) return false
  return (
    !!profile.kind &&
    profile.displayName.trim().length >= 2 &&
    isInnValidForKind(profile.inn, profile.kind) &&
    !!profile.attestedAt
  )
}

/**
 * Нормализует телефон РФ к формату +7XXXXXXXXXX. Возвращает null, если не похоже
 * на корректный номер (нужно для SupplierInfo в агентском чеке).
 */
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "")
  let n = d
  if (n.length === 11 && (n[0] === "7" || n[0] === "8")) n = "7" + n.slice(1)
  else if (n.length === 10) n = "7" + n
  else return null
  return "+" + n
}

/**
 * Профиль готов для формирования АГЕНТСКОГО чека покупателю: полный профиль +
 * телефон поставщика (обязателен для SupplierInfo). Без этого продавать Продукт
 * на Комиссии нельзя — иначе чек будет «браком» (доход припишут Оператору).
 */
export function hasAgentReceiptData(profile: PayoutProfile | null | undefined): boolean {
  return isProfileComplete(profile) && !!profile?.phone && !!normalizePhone(profile.phone)
}

// Текст заверений (оферта, п. 6). При изменении — поднять версию.
export const ATTESTATION_VERSION = "v1"
export const ATTESTATION_TEXT =
  "Я обладаю правовым статусом, позволяющим принимать оплату за Продукты " +
  "(самозанятый, ИП или юридическое лицо), предоставленные данные достоверны, " +
  "и я самостоятельно исполняю обязанности по формированию и передаче Покупателю " +
  "чека (54-ФЗ либо режим НПД) и по уплате налогов с дохода от продажи Продуктов."
