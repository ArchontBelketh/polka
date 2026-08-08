import yauzl from "yauzl"

/**
 * Чтение кода продукта для просмотра модератором. Работает в памяти (на диск
 * ничего не пишем — zip-slip неактуален). Лимиты защищают от чрезмерного
 * потребления памяти/бомб (сканер уже проверял файл при публикации, но здесь
 * защита продублирована на случай прямого вызова).
 */

export interface CodeFile {
  path: string
  size: number
  content?: string
  binary?: boolean
  truncated?: boolean
  skipped?: string // причина, если не показан
}

export interface CodeResult {
  kind: "single" | "archive" | "unsupported"
  files: CodeFile[]
  note?: string
}

const PER_FILE = 200 * 1024 // 200 КБ на файл к показу
const TOTAL = 3 * 1024 * 1024 // 3 МБ суммарно
const MAX_FILES = 300
const TIMEOUT_MS = 15_000

function looksBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8000)
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true
  return false
}

export async function readCodeFromBuffer(fileName: string, buffer: Buffer): Promise<CodeResult> {
  if (fileName.toLowerCase().endsWith(".zip")) return readArchive(buffer)

  // одиночный файл
  if (looksBinary(buffer)) {
    return { kind: "single", files: [{ path: fileName, size: buffer.length, binary: true }] }
  }
  const truncated = buffer.length > PER_FILE
  const content = (truncated ? buffer.subarray(0, PER_FILE) : buffer).toString("utf8")
  return { kind: "single", files: [{ path: fileName, size: buffer.length, content, truncated }] }
}

function readArchive(buffer: Buffer): Promise<CodeResult> {
  return new Promise((resolve) => {
    let settled = false
    const files: CodeFile[] = []
    let total = 0

    const finish = (note?: string) => {
      if (settled) return
      settled = true
      clearTimeout(watchdog)
      resolve({ kind: "archive", files, note })
    }
    const watchdog = setTimeout(() => finish("Чтение архива прервано по таймауту"), TIMEOUT_MS)

    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) {
        clearTimeout(watchdog)
        resolve({ kind: "unsupported", files: [], note: "Архив не читается" })
        return
      }

      zip.on("entry", (entry: yauzl.Entry) => {
        if (settled) return
        if (files.length >= MAX_FILES) { zip.close(); finish(`Показаны первые ${MAX_FILES} файлов`); return }

        // директории
        if (/[/\\]$/.test(entry.fileName)) { zip.readEntry(); return }
        // вложенные архивы не разворачиваем
        if (entry.fileName.toLowerCase().endsWith(".zip")) {
          files.push({ path: entry.fileName, size: entry.uncompressedSize, skipped: "вложенный архив" })
          zip.readEntry(); return
        }
        // слишком большой по заголовку
        if (entry.uncompressedSize > PER_FILE * 8) {
          files.push({ path: entry.fileName, size: entry.uncompressedSize, skipped: "слишком большой для просмотра" })
          zip.readEntry(); return
        }
        if (total > TOTAL) {
          files.push({ path: entry.fileName, size: entry.uncompressedSize, skipped: "превышен общий лимит просмотра" })
          zip.readEntry(); return
        }

        zip.openReadStream(entry, (e, rs) => {
          if (e || !rs || settled) { if (!settled) zip.readEntry(); return }
          const chunks: Buffer[] = []
          let bytes = 0
          let cut = false
          let pushed = false

          const pushResult = () => {
            if (pushed) return
            pushed = true
            const buf = Buffer.concat(chunks)
            total += buf.length
            if (looksBinary(buf)) {
              files.push({ path: entry.fileName, size: entry.uncompressedSize, binary: true })
            } else {
              files.push({
                path: entry.fileName,
                size: entry.uncompressedSize,
                content: buf.toString("utf8"),
                truncated: cut || entry.uncompressedSize > PER_FILE,
              })
            }
            if (!settled) zip.readEntry()
          }

          rs.on("data", (c: Buffer) => {
            if (cut) return
            bytes += c.length
            if (bytes > PER_FILE) { cut = true; try { rs.destroy() } catch {} ; return }
            chunks.push(c)
          })
          rs.on("close", pushResult)
          rs.on("end", pushResult)
          rs.on("error", () => { if (!settled) zip.readEntry() })
        })
      })

      zip.on("end", () => finish())
      zip.on("error", () => finish("Ошибка чтения архива"))
      zip.readEntry()
    })
  })
}
