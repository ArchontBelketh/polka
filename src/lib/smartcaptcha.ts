/**
 * Проверка Yandex SmartCaptcha на стороне сервера.
 *
 * Клиент присылает одноразовый токен, мы валидируем его через /validate.
 * Если SMARTCAPTCHA_SERVER_KEY не задан — капча считается выключенной
 * (verify возвращает true), чтобы локальная разработка и ещё не настроенный
 * прод не ломались. Включается автоматически, как только заданы ключи.
 *
 * Ключи: клиентский (публичный, в виджет — NEXT_PUBLIC_SMARTCAPTCHA_SITE_KEY)
 * и серверный (секрет — SMARTCAPTCHA_SERVER_KEY).
 */
const VALIDATE_URL = "https://smartcaptcha.yandexcloud.net/validate"

/** true, если капча выключена (нет серверного ключа). */
export function smartCaptchaDisabled(): boolean {
  return !process.env.SMARTCAPTCHA_SERVER_KEY
}

export async function verifySmartCaptcha(token: string | undefined | null, ip?: string): Promise<boolean> {
  const secret = process.env.SMARTCAPTCHA_SERVER_KEY
  if (!secret) return true // капча не настроена — пропускаем
  if (!token) return false

  const params = new URLSearchParams({ secret, token })
  if (ip) params.set("ip", ip)

  try {
    const resp = await fetch(`${VALIDATE_URL}?${params.toString()}`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) {
      // Сервис проверки недоступен — по рекомендации Yandex пропускаем живого
      // пользователя (fail-open), чтобы недоступность капчи не ломала регистрацию.
      console.warn("SmartCaptcha validate HTTP", resp.status, "— пропускаем (fail-open)")
      return true
    }
    const data = (await resp.json().catch(() => ({}))) as { status?: string }
    return data.status === "ok"
  } catch (err) {
    console.warn("SmartCaptcha validate error — пропускаем (fail-open)", err)
    return true
  }
}
