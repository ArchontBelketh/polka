const BASE_URL = "https://api.yookassa.ru/v3"

function authHeader(): string {
  const shopId = process.env.YOOKASSA_SHOP_ID!
  const secretKey = process.env.YOOKASSA_SECRET_KEY!
  return "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64")
}

export interface YooKassaPayment {
  id: string
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled"
  amount: { value: string; currency: string }
  description: string
  metadata: Record<string, string>
  confirmation?: { type: string; confirmation_url?: string; return_url?: string }
  paid: boolean
  refundable: boolean
  created_at: string
  captured_at?: string
}

export async function createPayment(params: {
  amountKopecks: number
  description: string
  returnUrl: string
  metadata: Record<string, string>
  idempotencyKey: string
}): Promise<YooKassaPayment> {
  const value = (params.amountKopecks / 100).toFixed(2)
  const resp = await fetch(`${BASE_URL}/payments`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      "Idempotence-Key": params.idempotencyKey,
    },
    body: JSON.stringify({
      amount: { value, currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: params.returnUrl },
      description: params.description,
      metadata: params.metadata,
    }),
  })
  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`YooKassa ${resp.status}: ${err}`)
  }
  return resp.json() as Promise<YooKassaPayment>
}

export async function getPayment(paymentId: string): Promise<YooKassaPayment> {
  const resp = await fetch(`${BASE_URL}/payments/${paymentId}`, {
    headers: { Authorization: authHeader() },
  })
  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`YooKassa ${resp.status}: ${err}`)
  }
  return resp.json() as Promise<YooKassaPayment>
}
