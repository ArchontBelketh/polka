import { getObjectBuffer } from "@/lib/s3"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { spawnSync } from "child_process"

const MAX_SNIPPET_CHARS = 8000
const SUPPORTED_EXTS = new Set([".py", ".js", ".ts", ".bsl", ".vba", ".bas", ".cls"])

export async function extractSnippets(s3Key: string, fileName: string): Promise<string> {
  if (!s3Key || s3Key.startsWith("local/")) {
    return "(файл недоступен в локальной среде разработки)"
  }

  let buffer: Buffer
  try {
    buffer = await getObjectBuffer(s3Key)
  } catch {
    return "(не удалось загрузить файл из хранилища)"
  }

  const ext = path.extname(fileName).toLowerCase()
  const tmpDir = path.join(os.tmpdir(), `polka-airev-${Date.now()}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  try {
    const filePath = path.join(tmpDir, fileName)
    fs.writeFileSync(filePath, buffer)

    if (ext === ".zip") {
      try {
        const unpackedDir = path.join(tmpDir, "unpacked")
        const r = spawnSync("unzip", ["-q", filePath, "-d", unpackedDir], { timeout: 15000 })
        if (r.error) throw r.error
        return collectFromDir(unpackedDir)
      } catch {
        return "(не удалось распаковать архив)"
      }
    }

    if (ext === ".epf" || ext === ".erf") {
      const outDir = path.join(tmpDir, "unpacked")
      fs.mkdirSync(outDir)
      try {
        const r = spawnSync("v8unpack", ["-U", filePath, outDir], { timeout: 15000 })
        if (r.error) throw r.error
        return collectFromDir(outDir)
      } catch {
        // fall back to raw binary snippet
        return truncate(buffer.toString("latin1").replace(/[^\x20-\x7E\n\r]/g, ""))
      }
    }

    if (SUPPORTED_EXTS.has(ext)) {
      return truncate(buffer.toString("utf8"))
    }

    return `(формат ${ext} не поддерживается для анализа)`
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

function collectFromDir(dir: string): string {
  const lines: string[] = []
  let total = 0

  function walk(d: string) {
    if (!fs.existsSync(d)) return
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (total >= MAX_SNIPPET_CHARS) break
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (SUPPORTED_EXTS.has(path.extname(entry.name).toLowerCase())) {
        const content = fs.readFileSync(full, "utf8")
        const snippet = `\n--- ${entry.name} ---\n${content}`
        lines.push(snippet)
        total += snippet.length
      }
    }
  }

  walk(dir)
  return truncate(lines.join("\n"))
}

function truncate(text: string): string {
  if (text.length <= MAX_SNIPPET_CHARS) return text
  return text.slice(0, MAX_SNIPPET_CHARS) + "\n… (обрезано)"
}
