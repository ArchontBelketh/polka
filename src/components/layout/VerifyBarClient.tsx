"use client"

import { useState } from "react"

export function VerifyBarClient() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle")

  async function resend() {
    setState("sending")
    try {
      await fetch("/api/auth/resend-verification", { method: "POST" })
      setState("sent")
    } catch {
      setState("idle")
    }
  }

  return (
    <div className="border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-center text-xs text-yellow-300">
      Подтвердите email, чтобы оставлять отзывы и задавать вопросы.{" "}
      {state === "sent" ? (
        <span className="text-yellow-200">Письмо отправлено — проверьте почту.</span>
      ) : (
        <button
          type="button"
          onClick={resend}
          disabled={state === "sending"}
          className="underline underline-offset-2 hover:text-yellow-200 disabled:opacity-60"
        >
          {state === "sending" ? "Отправляем…" : "Отправить письмо повторно"}
        </button>
      )}
    </div>
  )
}
