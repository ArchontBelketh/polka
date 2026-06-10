/**
 * Detects attempts to exchange contact details in public pre-purchase text
 * (Q&A questions and answers). The goal is to keep deals on the platform:
 * before a purchase, buyers and developers must not swap phone/email/messenger
 * handles to take the transaction elsewhere.
 */

const CONTACT_PATTERNS: RegExp[] = [
  /(\+7|\b8)[\s(-]?\d{3}[\s)-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/, // Russian phone
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, // email
  /t\.me\/[a-z0-9_]+/i, // telegram link
  /@[a-z0-9_]{5,}/i, // telegram-style handle
  /(wa\.me|whatsapp|viber|vk\.com|vk\.me)/i, // other messengers / VK
]

export const CONTACT_BLOCK_MESSAGE =
  "Обмен контактами до покупки запрещён правилами платформы. Уберите телефон, email или ссылки на мессенджеры."

/** Returns true if the text appears to contain contact details. */
export function containsContactInfo(text: string): boolean {
  return CONTACT_PATTERNS.some((re) => re.test(text))
}
