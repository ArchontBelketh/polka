"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { YandexMetrica } from "./YandexMetrica"

// Согласие на cookie (Политика ПДн, раздел 6 и «Согласие Д»).
// Необходимые cookie (вход, безопасность) работают всегда. Аналитические
// (Яндекс Метрика) грузятся ТОЛЬКО после согласия. Выбор хранится в куке 12 мес.
const COOKIE = "cp_cookie_consent"
const MAX_AGE = 60 * 60 * 24 * 365 // ~12 месяцев

type Choice = "all" | "necessary"

function readConsent(): Choice | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(/(?:^|;\s*)cp_cookie_consent=(all|necessary)/)
  return m ? (m[1] as Choice) : null
}

function writeConsent(c: Choice) {
  document.cookie = `${COOKIE}=${c}; path=/; max-age=${MAX_AGE}; samesite=lax`
  window.dispatchEvent(new Event("cp:consent-changed"))
}

// Внешний стор — кука согласия. useSyncExternalStore корректно разводит
// серверный снапшот (null) и клиентский (значение куки) без гидрационных
// предупреждений и без setState в эффекте.
function subscribe(cb: () => void) {
  window.addEventListener("cp:consent-changed", cb)
  return () => window.removeEventListener("cp:consent-changed", cb)
}

export function CookieConsent() {
  const consent = useSyncExternalStore(subscribe, readConsent, () => null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    const open = () => setSettingsOpen(true)
    window.addEventListener("cp:cookie-settings", open)
    return () => window.removeEventListener("cp:cookie-settings", open)
  }, [])

  const choose = useCallback((c: Choice) => {
    writeConsent(c)
    setSettingsOpen(false)
  }, [])

  const showPanel = consent === null || settingsOpen
  const settingsMode = settingsOpen

  return (
    <>
      {/* Метрика — только с согласия на аналитические cookie */}
      {consent === "all" && <YandexMetrica />}

      {showPanel && (
        <div className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-4 sm:left-auto sm:right-4 sm:max-w-md">
          <div className="rounded-xl border border-border bg-card p-4 shadow-2xl">
            {!settingsMode ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Мы используем необходимые cookie, чтобы сайт работал. С вашего согласия используем
                  аналитические cookie и Яндекс Метрику, чтобы понимать, какие страницы полезны.{" "}
                  <Link href="/legal/privacy" className="text-primary hover:underline">
                    Политика обработки персональных данных
                  </Link>.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => choose("all")}
                    className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    Принять все
                  </button>
                  <button
                    onClick={() => choose("necessary")}
                    className="h-9 rounded-md border border-input px-4 text-sm hover:bg-muted"
                  >
                    Только необходимые
                  </button>
                  <button
                    onClick={() => setSettingsOpen(true)}
                    className="h-9 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Настроить
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-foreground">Настройки cookie</h2>
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  <li>
                    <span className="font-medium text-foreground">Необходимые</span> — вход, безопасность,
                    сохранение выбора. Всегда включены, без них сайт не работает.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Аналитические</span> — Яндекс Метрика:
                    какие страницы полезны. Включаются только с вашего согласия.
                  </li>
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => choose("all")}
                    className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    Принять все
                  </button>
                  <button
                    onClick={() => choose("necessary")}
                    className="h-9 rounded-md border border-input px-4 text-sm hover:bg-muted"
                  >
                    Только необходимые
                  </button>
                </div>
                {consent && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Текущий выбор: {consent === "all" ? "все cookie" : "только необходимые"}.
                    Если отключаете аналитику — она перестанет грузиться со следующей загрузки страницы.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
