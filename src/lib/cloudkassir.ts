import { getOperatorInfo } from "@/lib/operator"

// Standalone-клиент кассы CloudKassir (KKT API CloudPayments) для чеков, НЕ
// привязанных к эквайрингу (расход — выплата самозанятому). Приход идёт через
// Init Т-Банка; здесь — отдельный вызов /kkt/receipt. Basic-auth (Public ID:Secret).
// Поля — camelCase-схема CloudKassir; суммы в РУБЛЯХ.
const RECEIPT_URL = "https://api.cloudpayments.ru/kkt/receipt"

export interface KktItem {
  label: string // ≤ 128
  price: number // рубли
  quantity: number
  amount: number // price × quantity, рубли
  vat: number | null // null = НДС не облагается (УСН)
  method?: number // 4 = полный расчёт
  object?: number // 14 = имущественное право, 4 = услуга
  additionalPositionInfo?: string
}

export interface KktReceiptInput {
  type: "Income" | "Expense" | "IncomeReturn" | "ExpenseReturn"
  email?: string
  items: KktItem[]
  taxationSystem: number
  amountRub: number
  invoiceId?: string
}

export async function sendKktReceipt(params: KktReceiptInput, requestId: string): Promise<{ ok: boolean; message?: string; receiptId?: string }> {
  const publicId = process.env.CLOUDKASSIR_PUBLIC_ID
  const apiSecret = process.env.CLOUDKASSIR_API_SECRET
  if (!publicId || !apiSecret) {
    console.error("[cloudkassir] нет CLOUDKASSIR_PUBLIC_ID / CLOUDKASSIR_API_SECRET")
    return { ok: false, message: "Касса не настроена (нет ключей)" }
  }
  const op = await getOperatorInfo()
  if (!op.inn) return { ok: false, message: "Не заполнен ИНН оператора (Настройки)" }

  const body = {
    inn: op.inn,
    Type: params.type,
    ...(params.invoiceId ? { invoiceId: params.invoiceId } : {}),
    customerReceipt: {
      ...(params.email ? { email: params.email } : {}),
      taxationSystem: params.taxationSystem,
      amounts: { electronic: params.amountRub },
      items: params.items,
    },
  }
  const auth = Buffer.from(`${publicId}:${apiSecret}`).toString("base64")

  try {
    const resp = await fetch(RECEIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}`, "X-Request-ID": requestId },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    })
    const data = (await resp.json().catch(() => ({}))) as { Success?: boolean; Model?: { Id?: string; ErrorCode?: number } }
    if (!resp.ok || data.Success !== true || !data.Model?.Id || data.Model.ErrorCode !== 0) {
      return { ok: false, message: "Приём чека не подтверждён. Проверьте его в кассе перед повторной отправкой." }
    }
    return { ok: true, receiptId: data.Model.Id }
  } catch {
    return { ok: false, message: "Ответ кассы не получен. Нужна сверка перед повторной отправкой." }
  }
}

export async function getKktReceiptStatus(receiptId: string): Promise<string> {
  const publicId = process.env.CLOUDKASSIR_PUBLIC_ID
  const secret = process.env.CLOUDKASSIR_API_SECRET
  if (!publicId || !secret) throw new Error("Receipt service is not configured")
  const response = await fetch(`${RECEIPT_URL}/status/get`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${publicId}:${secret}`).toString("base64")}` },
    body: JSON.stringify({ Id: receiptId }), signal: AbortSignal.timeout(20000),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || result.Success !== true || !["Queued", "Processed", "Error"].includes(result.Model)) throw new Error("Receipt status is unknown")
  return result.Model
}
