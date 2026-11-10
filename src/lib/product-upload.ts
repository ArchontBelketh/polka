// Preserve the attempt ID across retries and confirm the transferred bytes.
// Publication starts only after every required upload has been confirmed.
const attempts = new WeakMap<File, Map<string, string>>()

export async function uploadProductFile(productId: string, file: File, type: "source" | "screenshot", screenshotIndex?: number) {
  const slot = `${productId}/${type}/${screenshotIndex ?? 0}`
  let ids = attempts.get(file)
  if (!ids) { ids = new Map(); attempts.set(file, ids) }
  const uploadId = ids.get(slot) ?? crypto.randomUUID()
  ids.set(slot, uploadId)
  try {
    const response = await fetch("/api/upload", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadId, productId, type, fileName: file.name, fileSize: file.size, contentType: file.type || "application/octet-stream", screenshotIndex }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 410) ids.delete(slot)
      throw new Error(typeof result.error === "string" ? result.error : "Не удалось подготовить загрузку файла")
    }
    if (result.completed === true) return
    if (typeof result.uploadId !== "string") throw new Error("Не удалось определить попытку загрузки")
    if (typeof result.url !== "string" || !result.url) throw new Error("Хранилище файлов недоступно. Черновик сохранён в кабинете.")
    const uploaded = await fetch(result.url, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file })
    if (!uploaded.ok) throw new Error("Файл не загрузился. Черновик сохранён в кабинете; повторите загрузку перед модерацией.")
    const confirmed = await fetch(`/api/upload/${encodeURIComponent(result.uploadId)}/complete`, { method: "POST" })
    const confirmation = await confirmed.json().catch(() => ({}))
    if (!confirmed.ok) throw new Error(typeof confirmation.error === "string" ? confirmation.error : "Не удалось подтвердить загрузку. Повторите попытку.")
  } catch (error) {
    if (error instanceof TypeError) throw new Error("Ошибка сети. Повторите загрузку — уже подтверждённые файлы сохранятся.")
    throw error
  }
}
