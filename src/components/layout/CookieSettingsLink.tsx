"use client"

// Ссылка «Настройки cookie» в подвале — открывает окно настроек cookie
// (его слушает CookieConsent). Позволяет изменить выбор в любой момент (Политика 6.3).
export function CookieSettingsLink() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("cp:cookie-settings"))}
      className="text-left text-muted-foreground transition-colors hover:text-foreground"
    >
      Настройки cookie
    </button>
  )
}
