// Клиент-безопасные константы провайдера ИИ (без импорта БД) — можно использовать
// и в клиентских компонентах, и на сервере.

export type AiProvider = "disabled" | "gemini" | "yandexgpt"

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  disabled: "Выключено",
  gemini: "Google Gemini",
  yandexgpt: "YandexGPT",
}

export const DEFAULT_MODEL: Record<AiProvider, string> = {
  disabled: "",
  gemini: "gemini-2.5-flash",
  yandexgpt: "yandexgpt-lite",
}

export function coerceProvider(p: string | null | undefined): AiProvider {
  return p === "gemini" || p === "yandexgpt" ? p : "disabled"
}
