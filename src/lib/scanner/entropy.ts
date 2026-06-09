import fs from "fs"
import path from "path"
import type { ScanFinding } from "@/types"

const ENTROPY_THRESHOLD = 7.0

// Only check source-code text files; skip binaries where high entropy is normal
const TEXT_EXTS = new Set([".py", ".js", ".ts", ".jsx", ".tsx", ".bsl", ".vbs", ".ps1", ".bat", ".sh", ".rb"])
const MIN_BYTES = 512 // too small to be meaningful

function shannonEntropy(buf: Buffer): number {
  if (buf.length === 0) return 0
  const freq = new Float64Array(256)
  for (let i = 0; i < buf.length; i++) freq[buf[i]]++
  let entropy = 0
  for (let i = 0; i < 256; i++) {
    if (freq[i] === 0) continue
    const p = freq[i] / buf.length
    entropy -= p * Math.log2(p)
  }
  return entropy
}

export function checkEntropy(filePath: string): ScanFinding[] {
  const ext = path.extname(filePath).toLowerCase()
  if (!TEXT_EXTS.has(ext)) return []

  try {
    const buf = fs.readFileSync(filePath)
    if (buf.length < MIN_BYTES) return []
    const entropy = shannonEntropy(buf)
    if (entropy > ENTROPY_THRESHOLD) {
      return [
        {
          tool: "entropy",
          severity: "warning",
          message: `Высокая энтропия файла: ${entropy.toFixed(2)} bits/byte (порог ${ENTROPY_THRESHOLD}) — возможная обфускация кода или зашифрованный пейлоад`,
          file: path.basename(filePath),
        },
      ]
    }
  } catch {
    // Unreadable file — skip silently
  }
  return []
}
