"use client"

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react"

const consent = () => /(?:^|;\s*)cp_cookie_consent=all(?:;|$)/.test(document.cookie)
function subscribe(listener: () => void) { window.addEventListener("cp:consent-changed", listener); return () => window.removeEventListener("cp:consent-changed", listener) }
// Serialize the first request so separate observers receive the same HttpOnly
// visitor cookie. Analytics failure never interferes with navigation or forms.
let delivery = Promise.resolve()
function send(token: string, ids: string[]) {
  delivery = delivery.then(async () => {
    if (!consent()) return
    await fetch("/api/developers/events", { method: "POST", credentials: "same-origin", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ids }) })
  }).catch(() => {})
}
export function ExposureTracker({ token, profileId, children }: { token: string | null; profileId?: string; children?: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  const allowed = useSyncExternalStore(subscribe, consent, () => false)
  useEffect(() => {
    if (!allowed || !token) return
    if (profileId) {
      let timer: ReturnType<typeof setTimeout> | undefined
      const schedule = () => { clearTimeout(timer); if (document.visibilityState === "visible") timer = setTimeout(() => send(token, [profileId]), 1000) }
      schedule(); document.addEventListener("visibilitychange", schedule)
      return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", schedule) }
    }
    const timers = new Map<Element, ReturnType<typeof setTimeout>>(), sent = new Set<string>()
    const clearTimers = () => { timers.forEach(clearTimeout); timers.clear() }
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.developerId
        const previous = timers.get(entry.target); if (previous) clearTimeout(previous)
        timers.delete(entry.target)
        if (id && !sent.has(id) && entry.intersectionRatio >= 0.5 && document.visibilityState === "visible") timers.set(entry.target, setTimeout(() => { if (document.visibilityState !== "visible") return; sent.add(id); send(token, [id]); timers.delete(entry.target) }, 1000))
      }
    }, { threshold: [0, 0.5] })
    root.current?.querySelectorAll("[data-developer-id]").forEach(element => observer.observe(element))
    const visibilityChanged = () => {
      clearTimers()
      if (document.visibilityState === "visible") root.current?.querySelectorAll("[data-developer-id]").forEach(element => { observer.unobserve(element); observer.observe(element) })
    }
    document.addEventListener("visibilitychange", visibilityChanged)
    return () => { observer.disconnect(); clearTimers(); document.removeEventListener("visibilitychange", visibilityChanged) }
  }, [token, profileId, allowed])
  return <div ref={root}>{children}</div>
}
