"use client"

export async function jobFetch(url: string, body: unknown) {
  let response: Response
  try { response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) }
  catch { throw new Error("Ответ не получен. Обновите страницу, чтобы проверить результат действия.") }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Не удалось выполнить действие")
  return data
}
export const jobInputClass = "w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan disabled:opacity-60"
export const dateText = (value: Date | string) => new Date(value).toLocaleString("ru-RU")
