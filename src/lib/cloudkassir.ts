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

export async function sendKktReceipt(params: {
  type: "Income" | "Expense" | "IncomeReturn" | "ExpenseReturn"
  email?: string
  items: KktItem[]
  taxationSystem: number // 1 = УСН доход
  amountRub: number // общая сумма, рубли
  invoiceId?: string
}): Promise<{ ok: boolean; message?: string }> {
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
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    })
    const data = (await resp.json().catch(() => ({}))) as { Success?: boolean; Message?: string }
    if (!resp.ok || data.Success === false) {
      console.error("[cloudkassir] чек не принят:", resp.status, data.Message)
      return { ok: false, message: data.Message ?? `Ошибка кассы (HTTP ${resp.status})` }
    }
    return { ok: true, message: data.Message }
  } catch (err) {
    console.error("[cloudkassir] ошибка отправки чека:", err)
    return { ok: false, message: "Касса недоступна, попробуйте позже" }
  }
}
