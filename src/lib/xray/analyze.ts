import { execFile } from "child_process"
import { promisify } from "util"
import fs from "fs"
import os from "os"
import path from "path"
import { safeUnzip } from "@/lib/scanner/zip-safe"
import { checkOsv } from "./osv"
import type { XrayRaw, XrayReport } from "./types"

const execFileAsync = promisify(execFile)

const PYTHON_BIN = process.env.PYTHON_BIN ?? "python3"
const ANALYZE_TIMEOUT_MS = 30_000
const MAX_FILES_HINT = 500

export class XrayAnalysisError extends Error {
  constructor(message: string, public readonly status: 422 | 503 = 503) {
    super(message)
    this.name = "XrayAnalysisError"
  }
}

export interface XrayInput {
  /** Код, вставленный в поле (анализируется как snippet.py). */
  code?: string
  /** Содержимое загруженного .py или .zip. */
  fileBuffer?: Buffer
  fileName?: string
}

/** Один путь в dev и standalone; файл явно включён в сборку и Dockerfile. */
function resolveScript(): string {
  return path.join(process.cwd(), "src", "lib", "xray", "xray_analyze.py")
}

/**
 * Анализирует код/архив и возвращает отчёт X-Ray. Код НЕ сохраняется:
 * всё пишется во временный каталог и удаляется в finally.
 */
export async function analyzeXray(input: XrayInput): Promise<XrayReport> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "xray-"))
  try {
    const srcDir = path.join(tmp, "src")
    fs.mkdirSync(srcDir, { recursive: true })

    let root = srcDir
    const isZip =
      input.fileBuffer != null &&
      (input.fileName?.toLowerCase().endsWith(".zip") ||
        (input.fileBuffer.length >= 2 && input.fileBuffer[0] === 0x50 && input.fileBuffer[1] === 0x4b))

    if (isZip && input.fileBuffer) {
      const zipPath = path.join(tmp, "upload.zip")
      fs.writeFileSync(zipPath, input.fileBuffer)
      const un = await safeUnzip(zipPath, srcDir)
      if (!un.ok) throw new XrayAnalysisError("Архив не прошёл проверку безопасности.", 422)
      root = un.extractedDir
    } else if (input.fileBuffer) {
      fs.writeFileSync(path.join(srcDir, "snippet.py"), input.fileBuffer)
    } else if (typeof input.code === "string") {
      fs.writeFileSync(path.join(srcDir, "snippet.py"), input.code)
    }

    const raw = await runAnalyzer(root)
    const vulns = await checkOsv(raw.dependencies.packages)

    return { ...raw, vulns, osvCheckedAt: new Date().toISOString() }
  } finally {
    // Код и находки не сохраняются (приватность, раздел 7.7).
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

/**
 * Анализ уже подготовленного каталога (например, распакованных файлов продукта
 * при модерации). В отличие от analyzeXray — не создаёт и не удаляет temp,
 * работает по переданному пути.
 */
export async function analyzeDir(root: string): Promise<XrayReport> {
  const raw = await runAnalyzer(root)
  const vulns = await checkOsv(raw.dependencies.packages)
  return { ...raw, vulns, osvCheckedAt: new Date().toISOString() }
}

async function runAnalyzer(root: string): Promise<XrayRaw> {
  const script = resolveScript()
  try {
    const { stdout } = await execFileAsync(
      PYTHON_BIN, [script, root],
      { timeout: ANALYZE_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
    )
    const raw = JSON.parse(stdout) as XrayRaw
    if (!raw || !Number.isSafeInteger(raw.files_analyzed) || !raw.facts || !raw.dependencies ||
        !Array.isArray(raw.dependencies.packages) || !Array.isArray(raw.parse_errors)) {
      throw new XrayAnalysisError("Анализатор вернул некорректный результат. Повторите позже.")
    }
    if (raw.files_analyzed === 0) {
      throw new XrayAnalysisError("Не удалось проанализировать Python-файлы. Проверьте код и формат файла.", 422)
    }
    return raw
  } catch (err) {
    if (err instanceof XrayAnalysisError) throw err
    throw new XrayAnalysisError("Проверка кода временно недоступна. Повторите позже.")
  }
}

export const XRAY_LIMITS = { maxFilesHint: MAX_FILES_HINT, timeoutMs: ANALYZE_TIMEOUT_MS }
