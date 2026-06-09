/**
 * Multi-layer zip bomb protection.
 *
 * Layer 0  — Path traversal (zip slip) prevention
 * Layer 1  — Central directory pre-checks  (zero-decompression, instant)
 *   1a. Entry count        > MAX_ENTRY_COUNT (10 000)
 *   1b. Single file size   > SINGLE_FILE_LIMIT (512 MB declared)
 *   1c. Compression ratio  > MAX_RATIO:1 for files > 1 MB
 *   1d. Total declared     > TOTAL_LIMIT (1.5 GB accumulated)
 * Layer 2  — Streaming extraction with live byte counters (catches spoofed headers)
 *   2a. Per-entry counter  > SINGLE_FILE_LIMIT → abort immediately
 *   2b. Global counter     > TOTAL_LIMIT (Docker sandbox equivalent) → abort
 * Layer 3  — Timeout watchdog: extraction must finish within 60 s
 * Layer 4  — Nested zip prevention: inner .zip files are skipped (no recursive bombs)
 */

import fs from "fs"
import path from "path"
import yauzl from "yauzl"
import type { ScanFinding } from "@/types"

// ── Limits (can be tuned via env vars) ───────────────────────────────────────
const TOTAL_LIMIT       = parseEnvBytes("SCAN_MAX_EXTRACT_BYTES",  1.5 * 1024 ** 3) // 1.5 GB
const SINGLE_FILE_LIMIT = parseEnvBytes("SCAN_MAX_FILE_BYTES",     512  * 1024 ** 2) // 512 MB
const MAX_ENTRY_COUNT   = parseInt(process.env.SCAN_MAX_ZIP_ENTRIES ?? "") || 10_000
const MAX_RATIO         = 200  // :1 compression ratio ceiling (only for files > 1 MB)
const TIMEOUT_MS        = parseInt(process.env.SCAN_ZIP_TIMEOUT_MS ?? "") || 60_000

// ─────────────────────────────────────────────────────────────────────────────

export interface UnzipResult {
  /** true = extraction finished normally; false = bomb / timeout detected */
  ok: boolean
  findings: ScanFinding[]
  /** destination directory (may be partially filled when ok=false) */
  extractedDir: string
}

export function safeUnzip(zipPath: string, destDir: string): Promise<UnzipResult> {
  const extractedDir = path.join(destDir, "unzipped")
  fs.mkdirSync(extractedDir, { recursive: true })

  const findings: ScanFinding[] = []
  const archiveName = path.basename(zipPath)

  return new Promise<UnzipResult>((resolve) => {
    let settled = false
    let aborted = false
    /** Actual bytes written to disk across all entries (Layer 2b — sandbox counter) */
    let globalBytesWritten = 0

    function abort(finding: ScanFinding) {
      if (settled) return
      settled = true
      aborted = true
      clearTimeout(watchdog)
      findings.push(finding)
      resolve({ ok: false, findings, extractedDir })
    }

    function done() {
      if (settled) return
      settled = true
      clearTimeout(watchdog)
      resolve({ ok: true, findings, extractedDir })
    }

    // ── Layer 3: timeout watchdog ─────────────────────────────────────────
    const watchdog = setTimeout(() => {
      abort({
        tool: "size-check",
        severity: "critical",
        message: `Zip-бомба (Layer 3/Таймаут): извлечение архива прервано после ${TIMEOUT_MS / 1000}с`,
        file: archiveName,
      })
    }, TIMEOUT_MS)

    yauzl.open(zipPath, { lazyEntries: true }, (openErr, zipfile) => {
      if (openErr || !zipfile) {
        clearTimeout(watchdog)
        findings.push({
          tool: "size-check",
          severity: "warning",
          message: `Архив не читается: ${openErr?.message ?? "неизвестная ошибка"}`,
          file: archiveName,
        })
        done()
        return
      }

      // ── Layer 1a: entry count ─────────────────────────────────────────
      if (zipfile.entryCount > MAX_ENTRY_COUNT) {
        zipfile.close()
        abort({
          tool: "size-check",
          severity: "critical",
          message: `Zip-бомба (Layer 1): ${fmt(zipfile.entryCount, "entries")} файлов — лимит ${MAX_ENTRY_COUNT.toLocaleString("ru-RU")}`,
          file: archiveName,
        })
        return
      }

      /** Sum of declared uncompressed sizes from central directory */
      let totalDeclared = 0

      // ────────────────────────────────────────────────────────────────────
      zipfile.on("entry", (entry: yauzl.Entry) => {
        if (aborted) return

        // ── Layer 1b: single-entry declared size ─────────────────────────
        if (entry.uncompressedSize > SINGLE_FILE_LIMIT) {
          zipfile.close()
          abort({
            tool: "size-check",
            severity: "critical",
            message: `Zip-бомба (Layer 1): файл «${shortName(entry.fileName)}» декларирует ${fmtBytes(entry.uncompressedSize)} — лимит ${fmtBytes(SINGLE_FILE_LIMIT)}`,
            file: archiveName,
          })
          return
        }

        // ── Layer 1c: compression ratio from headers ──────────────────────
        if (entry.compressedSize > 0) {
          const ratio = entry.uncompressedSize / entry.compressedSize
          if (ratio > MAX_RATIO && entry.uncompressedSize > 1024 * 1024) {
            zipfile.close()
            abort({
              tool: "size-check",
              severity: "critical",
              message: `Zip-бомба (Layer 1): сжатие ${Math.round(ratio)}:1 для «${shortName(entry.fileName)}» — лимит ${MAX_RATIO}:1`,
              file: archiveName,
            })
            return
          }
        }

        // ── Layer 1d: running declared total ──────────────────────────────
        totalDeclared += entry.uncompressedSize
        if (totalDeclared > TOTAL_LIMIT) {
          zipfile.close()
          abort({
            tool: "size-check",
            severity: "critical",
            message: `Zip-бомба (Layer 1): суммарный декларируемый размер ${fmtBytes(totalDeclared)} превышает лимит ${fmtBytes(TOTAL_LIMIT)}`,
            file: archiveName,
          })
          return
        }

        // Skip directory entries
        if (/[/\\]$/.test(entry.fileName)) {
          zipfile.readEntry()
          return
        }

        // ── Layer 4: skip nested zips (prevents 42.zip-style recursion) ──
        if (entry.fileName.toLowerCase().endsWith(".zip")) {
          findings.push({
            tool: "size-check",
            severity: "warning",
            message: `Вложенный архив пропущен: «${shortName(entry.fileName)}»`,
            file: archiveName,
          })
          zipfile.readEntry()
          return
        }

        // ── Layer 0: path traversal prevention (zip slip) ─────────────────
        const safePath = sanitizePath(entry.fileName)
        if (!safePath) {
          findings.push({
            tool: "size-check",
            severity: "warning",
            message: `Пропущен файл с опасным путём (zip slip): «${shortName(entry.fileName)}»`,
            file: archiveName,
          })
          zipfile.readEntry()
          return
        }

        // ── Layer 2: streaming extraction with live counters ──────────────
        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream || aborted) {
            if (!aborted) zipfile.readEntry()
            return
          }

          const outPath = path.join(extractedDir, safePath)
          try {
            fs.mkdirSync(path.dirname(outPath), { recursive: true })
          } catch {
            zipfile.readEntry()
            return
          }

          let entryBytes = 0
          const writeStream = fs.createWriteStream(outPath)

          const killEntry = (finding: ScanFinding) => {
            try { readStream.destroy() } catch {}
            try { writeStream.destroy() } catch {}
            try { fs.unlinkSync(outPath) } catch {}
            zipfile.close()
            abort(finding)
          }

          readStream.on("data", (chunk: Buffer) => {
            if (aborted) return

            entryBytes += chunk.length
            globalBytesWritten += chunk.length

            // Layer 2a: per-entry streaming limit
            if (entryBytes > SINGLE_FILE_LIMIT) {
              killEntry({
                tool: "size-check",
                severity: "critical",
                message: `Zip-бомба (Layer 2): реальный размер «${shortName(entry.fileName)}» превысил ${fmtBytes(SINGLE_FILE_LIMIT)} при декомпрессии`,
                file: archiveName,
              })
              return
            }

            // Layer 2b: Docker sandbox global limit
            if (globalBytesWritten > TOTAL_LIMIT) {
              killEntry({
                tool: "size-check",
                severity: "critical",
                message: `Zip-бомба (Layer 2/Sandbox): суммарный реальный размер распаковки превысил ${fmtBytes(TOTAL_LIMIT)} — аварийная остановка`,
                file: archiveName,
              })
              return
            }
          })

          readStream.pipe(writeStream)
          readStream.on("error", () => { if (!aborted) zipfile.readEntry() })
          writeStream.on("error", () => { if (!aborted) zipfile.readEntry() })
          writeStream.on("finish", () => { if (!aborted) zipfile.readEntry() })
        })
      })
      // ────────────────────────────────────────────────────────────────────

      zipfile.on("end",   () => done())
      zipfile.on("close", () => { if (!aborted) done() })
      zipfile.on("error", (e) => {
        findings.push({
          tool: "size-check",
          severity: "warning",
          message: `Ошибка архива: ${e.message}`,
          file: archiveName,
        })
        if (!aborted) done()
      })

      zipfile.readEntry()
    })
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitizePath(entryName: string): string | null {
  const normalized = path.posix.normalize(entryName.replace(/\\/g, "/"))
  // Reject absolute paths and path traversal
  if (normalized.startsWith("/") || normalized.startsWith("..")) return null
  // Reject null bytes
  if (normalized.includes("\0")) return null
  return normalized
}

function shortName(name: string, max = 80): string {
  return name.length > max ? name.slice(0, max) + "…" : name
}

function fmtBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} ГБ`
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(0)} МБ`
  return `${(n / 1024).toFixed(0)} КБ`
}

function fmt(n: number, _unit: string): string {
  return n.toLocaleString("ru-RU")
}

function parseEnvBytes(key: string, fallback: number): number {
  const v = parseInt(process.env[key] ?? "")
  return isNaN(v) ? fallback : v
}
