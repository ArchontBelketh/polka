import { createHmac, createHash } from "crypto"

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

/**
 * Verifies Telegram Login Widget data.
 * https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramAuth(data: TelegramUser): boolean {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return false

  const { hash, ...rest } = data

  // Build the data-check-string: sorted key=value pairs joined with \n
  const checkString = Object.entries(rest)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n")

  // Secret key = SHA256(bot_token) — NOT HMAC, raw hash
  const secretKey = createHash("sha256").update(botToken).digest()
  const expectedHash = createHmac("sha256", secretKey)
    .update(checkString)
    .digest("hex")

  if (expectedHash !== hash) return false

  // auth_date must be within 1 hour
  const age = Math.floor(Date.now() / 1000) - rest.auth_date
  return age < 3600
}
