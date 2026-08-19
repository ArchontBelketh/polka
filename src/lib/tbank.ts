import { createHash } from "crypto"

// Интернет-эквайринг Т-Банка (Tinkoff). API v2.
// Аутентификация — подписью Token (SHA-256), а не Basic-auth.
// Интерфейс совместим с прежним ЮKassa-обёрткой (createPayment/getPayment/createRefund),
// чтобы вызывающий код почти не менялся.

const BASE_URL = "https://securepay.tinkoff.ru/v2"

function terminalKey(): string {
  return process.env.TBANK_TERMINAL_KEY ?? ""
}
function password(): string {
  return process.env.TBANK_PASSWORD ?? ""
}

/**
 * Подпись Т-Банка: к корневым скалярным параметрам добавляется Password,
 * ключи сортируются по алфавиту, значения конкатенируются, берётся SHA-256.
 * Вложенные объекты (DATA, Receipt) и сам Token в подпись НЕ входят.
 */
export function genToken(params: Record<string, string | number | boolean>): string {
  const withPass: Record<string, string | number | boolean> = { ...params, Password: password() }
  const concat = Object.keys(withPass)
    .sort()
    .map((k) => {
      const v = withPass[k]
      return typeof v === "boolean" ? (v ? "true" : "false") : String(v)
    })
    .join("")
  return createHash("sha256").update(concat, "utf8").digest("hex")
}

export interface TBankPayment {
  id: string
  confirmation: { confirmation_url?: string }
}

// createPayment сохраняет прежнюю сигнатуру. metadata передаётся в DATA
// (Т-Банк возвращает DATA в нотификации), а OrderId = idempotencyKey (уникален).
export async function createPayment(params: {
  amountKopecks: number
  description: string
  returnUrl: string
  metadata: Record<string, string>
  idempotencyKey: string
}): Promise<TBankPayment> {
  const root = {
    TerminalKey: terminalKey(),
    Amount: params.amountKopecks,
    OrderId: params.idempotencyKey,
    Description: params.description.slice(0, 250),
    SuccessURL: params.returnUrl,
    FailURL: params.returnUrl,
  }
  const body = { ...root, DATA: params.metadata, Token: genToken(root) }

  const resp = await fetch(`${BASE_URL}/Init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await resp.json().catch(() => ({}))) as {
    Success?: boolean; PaymentId?: string | number; PaymentURL?: string; Message?: string; Details?: string
  }
  if (!resp.ok || !data.Success || !data.PaymentId) {
    throw new Error(`T-Bank Init ${resp.status}: ${data.Message ?? "ошибка"} ${data.Details ?? ""}`.trim())
  }
  return { id: String(data.PaymentId), confirmation: { confirmation_url: data.PaymentURL } }
}

export interface TBankState {
  id: string
  /** Сырой статус Т-Банка: NEW | AUTHORIZED | CONFIRMED | REJECTED | REFUNDED | CANCELED | ... */
  status: string
}

export async function getPayment(paymentId: string): Promise<TBankState> {
  const root = { TerminalKey: terminalKey(), PaymentId: paymentId }
  const body = { ...root, Token: genToken(root) }
  const resp = await fetch(`${BASE_URL}/GetState`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await resp.json().catch(() => ({}))) as { Success?: boolean; Status?: string; Message?: string }
  if (!resp.ok || !data.Success) {
    throw new Error(`T-Bank GetState ${resp.status}: ${data.Message ?? "ошибка"}`)
  }
  return { id: paymentId, status: data.Status ?? "UNKNOWN" }
}

// Возврат средств покупателю (Cancel). Полный или частичный.
export async function createRefund(
  paymentId: string,
  amountKopecks: number,
  _idempotencyKey?: string,
): Promise<{ id: string; status: string }> {
  const root = { TerminalKey: terminalKey(), PaymentId: paymentId, Amount: amountKopecks }
  const body = { ...root, Token: genToken(root) }
  const resp = await fetch(`${BASE_URL}/Cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await resp.json().catch(() => ({}))) as {
    Success?: boolean; PaymentId?: string | number; Status?: string; Message?: string
  }
  if (!resp.ok || !data.Success) {
    throw new Error(`T-Bank Cancel ${resp.status}: ${data.Message ?? "ошибка"}`)
  }
  return { id: String(data.PaymentId ?? paymentId), status: data.Status ?? "UNKNOWN" }
}

/**
 * Проверка подписи нотификации (вебхука). Т-Банк присылает Token, посчитанный
 * из корневых скалярных полей + Password. DATA и Token в подпись не входят.
 */
export function verifyNotificationToken(body: Record<string, unknown>): boolean {
  const token = body.Token
  if (typeof token !== "string" || !token) return false

  const scalar: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(body)) {
    if (k === "Token" || k === "DATA" || k === "Receipt") continue
    if (v === null || v === undefined) continue
    if (typeof v === "object") continue
    scalar[k] = v as string | number | boolean
  }
  const expected = genToken(scalar)
  return expected === token
}
