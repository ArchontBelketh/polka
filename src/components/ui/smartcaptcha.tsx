"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"

// Yandex SmartCaptcha, видимый режим (чекбокс «Я не робот»). Клиентский ключ
// публичный (NEXT_PUBLIC_*). Если ключ не задан — виджет не рендерится, капча
// считается выключенной. Токен приходит в onToken, когда пользователь проходит
// проверку; onToken(null) — при истечении/сбросе/ошибке.
const SITE_KEY = process.env.NEXT_PUBLIC_SMARTCAPTCHA_SITE_KEY

interface SmartCaptchaApi {
  render: (
    container: HTMLElement | string,
    params: {
      sitekey: string
      callback?: (token: string) => void
      hl?: string
    },
  ) => string
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
  /** Сбросить виджет (получить свежий токен — токен одноразовый). */
  reset: () => void
}

export const SmartCaptcha = forwardRef<SmartCaptchaHandle, { onToken: (token: string | null) => void }>(
  function SmartCaptcha({ onToken }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const widgetId = useRef<string | null>(null)

    useImperativeHandle(
      ref,
      () => ({
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
    // Видимый виджет сам показывает брендинг и уведомление об обработке данных
    // (в отличие от невидимого «щита», который висел бы поверх всего сайта).
    return <div ref={containerRef} className="flex justify-center" />
  },
)
