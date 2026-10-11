import { exec } from "child_process"
import { promisify } from "util"
import fs from "fs"
import os from "os"
import path from "path"
import { safeUnzip } from "@/lib/scanner/zip-safe"
import { checkOsv } from "./osv"
import type { XrayRaw, XrayReport } from "./types"

const execAsync = promisify(exec)

const PYTHON_BIN = process.env.PYTHON_BIN ?? "python3"
const ANALYZE_TIMEOUT_MS = 30_000
const MAX_FILES_HINT = 500

export interface XrayInput {
  /** Код, вставленный в поле (анализируется как snippet.py). */
  code?: string
  /** Содержимое загруженного .py или .zip. */
  fileBuffer?: Buffer
  fileName?: string
}

/** Путь к Python-анализатору: прод (COPY в /app) или dev (из src). */
function resolveScript(): string {
  const candidates = [
    path.join(process.cwd(), "xray_analyze.py"),
    path.join(process.cwd(), "src", "lib", "xray", "xray_analyze.py"),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return candidates[0]
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
      root = un.extractedDir
      // Находки распаковки (zip-бомба/traversal) прокинем через parse_errors-канал позже,
      // но на MVP достаточно того, что анализ идёт по безопасно извлечённому дереву.
    } else if (input.fileBuffer) {
      const name = input.fileName?.toLowerCase().endsWith(".py") ? "snippet.py" : "snippet.py"
      fs.writeFileSync(path.join(srcDir, name), input.fileBuffer)
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
    const { stdout } = await execAsync(
      `${PYTHON_BIN} "${script}" "${root}"`,
      { timeout: ANALYZE_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
    )
    return JSON.parse(stdout) as XrayRaw
  } catch (err) {
    // Таймаут/сбой анализатора — возвращаем пустой каркас, чтобы отчёт не падал.
    const stdout = (err as { stdout?: string }).stdout
    if (stdout) {
      try {
        return JSON.parse(stdout) as XrayRaw
      } catch {
        /* fall through */
      }
    }
    return emptyRaw()
  }
}

function emptyRaw(): XrayRaw {
  return {
    language: "python",
    files_analyzed: 0,
    files_skipped: [],
    parse_errors: [],
    facts: { internet: [], files: [], commands: [], secrets: [], suspicious: [] },
    addresses: { urls: [], ips: [], flags: [] },
    dependencies: { ecosystem: "PyPI", packages: [] },
  }
}

export const XRAY_LIMITS = { maxFilesHint: MAX_FILES_HINT, timeoutMs: ANALYZE_TIMEOUT_MS }
