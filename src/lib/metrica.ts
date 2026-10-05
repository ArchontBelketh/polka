// Хелпер отправки целей в Яндекс.Метрику с клиента.
// Цель нужно один раз завести в интерфейсе Метрики как «JavaScript-событие»
// с тем же идентификатором (напр. sell_cta_register), тогда reachGoal её засчитает.
export function reachGoal(goal: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return
  const id = process.env.NEXT_PUBLIC_YANDEX_METRICA_ID
  if (!id) return
  const ym = (window as unknown as { ym?: (...args: unknown[]) => void }).ym
  if (typeof ym === "function") ym(Number(id), "reachGoal", goal, params)
}
