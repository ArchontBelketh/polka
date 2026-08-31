import { getKassaSettings, isKassaReady } from "@/lib/kassa-settings"

// Клиент фискального API CloudKassir (KKT API CloudPayments).
// POST /kkt/receipt, авторизация HTTP Basic (Public ID : API Secret).
// Фискализация асинхронная: успех = принято в очередь. Ошибки логируем, но НЕ
// бросаем — сбой чека не должен откатывать уже оплаченную покупку.

const RECEIPT_URL = "https://api.cloudpayments.ru/kkt/receipt"

export interface KktPurveyorData {
  Name: string // наименование поставщика (тег 1225)
  Inn: string // ИНН поставщика (тег 1226)
  Phone?: string // телефон поставщика (для AgentSign 4 — необязателен)
}
export interface KktItem {
  Label: string // ≤124
  Price: number // рубли
  Quantity: number
  Amount: number // Price*Quantity, рубли
  Vat: number | null // null = НДС не облагается (УСН)
  Method?: number // 4 = полный расчёт
  Object?: number // 4 = услуга, 14 = имущественное право
  AgentSign?: number // 4 = поверенный
  PurveyorData?: KktPurveyorData
}
export interface KktReceipt {
  Email?: string
  Phone?: string
  TaxationSystem: number // 1 = УСН доход
  Items: KktItem[]
  Amounts: { Electronic: number } // сумма в рублях, должна сходиться с позициями
}

/**
 * Отправить чек в кассу. Возвращает true при успешной постановке в очередь.
 * Никогда не бросает исключений.
 */
export async function sendReceipt(params: {
  type: "Income" | "IncomeReturn"
  receipt: KktReceipt
  invoiceId?: string
  accountId?: string
}): Promise<boolean> {
  const s = await getKassaSettings()
  if (!isKassaReady(s)) return false

  const body = {
    Inn: s.inn,
    Type: params.type,
    InvoiceId: params.invoiceId,
    AccountId: params.accountId,
    CustomerReceipt: params.receipt,
  }
  const auth = Buffer.from(`${s.publicId}:${s.apiSecret}`).toString("base64")

  try {
    const resp = await fetch(RECEIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
    const data = (await resp.json().catch(() => ({}))) as { Success?: boolean; Message?: string }
    if (!resp.ok || !data.Success) {
      console.error("[cloudkassir] чек не принят:", resp.status, data.Message)
      return false
    }
    return true
  } catch (err) {
    console.error("[cloudkassir] ошибка отправки чека:", err)
    return false
  }
}
