"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"

// Yandex SmartCaptcha, невидимый режим. Клиентский ключ публичный (NEXT_PUBLIC_*).
// Если ключ не задан — виджет не рендерится, капча считается выключенной.
const SITE_KEY = process.env.NEXT_PUBLIC_SMARTCAPTCHA_SITE_KEY

interface SmartCaptchaApi {
  render: (
    container: HTMLElement | string,
    params: {
      sitekey: string
      callback?: (token: string) => void
      invisible?: boolean
      hl?: string
      hideShield?: boolean
    },
  ) => string
  execute: (widgetId?: string) => void
  reset: (widgetId?: string) => void
  destroy: (widgetId?: string) => void
  subscribe: (widgetId: string, event: string, cb: (...args: unknown[]) => void) => () => void
}

declare global {
  interface Window {
    smartCaptcha?: SmartCaptchaApi
  }
}

export const smartCaptchaEnabled = !!SITE_KEY

export interface SmartCaptchaHandle {
  /** Запустить невидимую проверку. Токен придёт в onToken. */
  execute: () => void
  /** Сбросить виджет (получить свежий токен при следующем execute). */
  reset: () => void
}

/**
 * Невидимая капча. Токен НЕ появляется сам — родитель вызывает execute()
 * (например, при сабмите формы); успех приходит в onToken(token), а сбой/
 * истечение — в onToken(null).
 */
export const SmartCaptcha = forwardRef<SmartCaptchaHandle, { onToken: (token: string | null) => void }>(
  function SmartCaptcha({ onToken }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const widgetId = useRef<string | null>(null)

    useImperativeHandle(
      ref,
      () => ({
        execute() {
          if (window.smartCaptcha && widgetId.current) window.smartCaptcha.execute(widgetId.current)
        },
        reset() {
          if (window.smartCaptcha && widgetId.current) window.smartCaptcha.reset(widgetId.current)
        },
      }),
      [],
    )

    useEffect(() => {
      if (!SITE_KEY) return

      function renderWidget() {
        if (!containerRef.current || !window.smartCaptcha || widgetId.current) return
        const id = window.smartCaptcha.render(containerRef.current, {
          sitekey: SITE_KEY!,
          invisible: true,
          hl: "ru",
          callback: (token) => onToken(token),
        })
        widgetId.current = id
        window.smartCaptcha.subscribe(id, "token-expired", () => onToken(null))
        window.smartCaptcha.subscribe(id, "network-error", () => onToken(null))
        window.smartCaptcha.subscribe(id, "javascript-error", () => onToken(null))
      }

      const scriptId = "ya-smartcaptcha-script"
      let poll: ReturnType<typeof setInterval> | undefined

      if (window.smartCaptcha) {
        renderWidget()
      } else if (!document.getElementById(scriptId)) {
        const s = document.createElement("script")
        s.id = scriptId
        s.src = "https://smartcaptcha.yandexcloud.net/captcha.js"
        s.async = true
        s.defer = true
        s.onload = renderWidget
        document.head.appendChild(s)
      } else {
        poll = setInterval(() => {
          if (window.smartCaptcha) {
            clearInterval(poll)
            renderWidget()
          }
        }, 200)
      }

      return () => {
        if (poll) clearInterval(poll)
        if (widgetId.current && window.smartCaptcha) {
          window.smartCaptcha.destroy(widgetId.current)
          widgetId.current = null
        }
      }
    }, [onToken])

    if (!SITE_KEY) return null
    return <div ref={containerRef} />
  },
)
