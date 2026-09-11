// Проверка статуса самозанятого (НПД) через открытый API ФНС.
// Бесплатно, без авторизации и согласия проверяемого. Лимит 2 запроса/мин с IP,
// таймаут ответа до 60 с. Возвращает true/false на текущую дату.
const FNS_URL = "https://statusnpd.nalog.ru/api/v1/tracker/taxpayer_status"

export interface FnsStatusResult {
  ok: boolean // запрос выполнился успешно
  isSelfEmployed?: boolean // результат проверки (если ok)
  message: string // текст для показа
}

export async function checkSelfEmployedStatus(inn: string): Promise<FnsStatusResult> {
  const requestDate = new Date().toISOString().slice(0, 10) // YYYY-MM-DD, сегодня

  try {
    const resp = await fetch(FNS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inn, requestDate }),
      signal: AbortSignal.timeout(60000),
    })
    const data = (await resp.json().catch(() => ({}))) as {
      status?: boolean
      message?: string
      code?: string
    }
    if (resp.status === 200 && typeof data.status === "boolean") {
      return { ok: true, isSelfEmployed: data.status, message: data.message ?? "" }
    }
    // 400/422/500 — ошибка формата, бизнес-ошибка или сбой ФНС
    return { ok: false, message: data.message ?? `Ошибка ФНС (HTTP ${resp.status})` }
  } catch {
    return { ok: false, message: "Сервис ФНС недоступен, попробуйте позже" }
  }
}
