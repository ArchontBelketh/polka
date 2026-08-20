import { cache } from "react"
import { db } from "@/lib/db"

export interface OperatorInfo {
  name: string | null
  inn: string | null
  ogrn: string | null
  bankAccount: string | null
  address: string | null
  email: string | null
  phone: string | null
  revisionDate: string | null
}

const EMPTY: OperatorInfo = {
  name: null, inn: null, ogrn: null, bankAccount: null, address: null, email: null, phone: null,
  revisionDate: null,
}

// cache() дедуплицирует запрос в рамках одного рендера (футер + страница за 1 запрос).
// try/catch — на случай, если таблицы ещё нет (до db push): вернём пустые → плейсхолдер.
export const getOperatorInfo = cache(async (): Promise<OperatorInfo> => {
  try {
    const row = await db.operatorSettings.findUnique({ where: { id: "singleton" } })
    if (!row) return EMPTY
    return {
      name: row.name, inn: row.inn, ogrn: row.ogrn, bankAccount: row.bankAccount,
      address: row.address, email: row.email, phone: row.phone, revisionDate: row.revisionDate,
    }
  } catch {
    return EMPTY
  }
})

const PLACEHOLDER = "[Реквизиты не заполнены — укажите в админке (Настройки)]"

/** Полная строка реквизитов — только заполненные поля. */
export function operatorRequisitesLine(op: OperatorInfo): string {
  const parts: string[] = []
  if (op.name) parts.push(op.name)
  if (op.inn) parts.push(`ИНН ${op.inn}`)
  if (op.ogrn) parts.push(`ОГРН ${op.ogrn}`)
  if (op.bankAccount) parts.push(`р/с ${op.bankAccount}`)
  if (op.address) parts.push(op.address)
  if (op.email) parts.push(op.email)
  if (op.phone) parts.push(op.phone)
  return parts.length ? parts.join(", ") : PLACEHOLDER
}

/** Дата редакции документов (или плейсхолдер, если не задана). */
export function operatorRevision(op: OperatorInfo): string {
  return op.revisionDate?.trim() ? op.revisionDate : "[ДАТА]"
}

/** Короткая строка (наименование + ИНН + ОГРН + email) — для футера. */
export function operatorShortLine(op: OperatorInfo): string {
  const parts: string[] = []
  if (op.name) parts.push(op.name)
  if (op.inn) parts.push(`ИНН ${op.inn}`)
  if (op.ogrn) parts.push(`ОГРН ${op.ogrn}`)
  if (op.email) parts.push(op.email)
  return parts.length ? parts.join(", ") : PLACEHOLDER
}
