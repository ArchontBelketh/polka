import { exec } from "child_process"
import { promisify } from "util"
import fs from "fs"
import path from "path"
import type { ScanFinding } from "@/types"
import { BSL_CRITICAL, BSL_WARNING } from "./patterns"

const execAsync = promisify(exec)

export async function scanEpf(
  filePath: string,
  outDir: string,
): Promise<{ findings: ScanFinding[]; ran: boolean }> {
  // Try to unpack with v8unpack
  const unpacked = path.join(outDir, "epf_unpacked")
  try {
    await execAsync(`v8unpack -U "${filePath}" "${unpacked}"`, { timeout: 30_000 })
  } catch (err: unknown) {
    if (isNoSuchFileError(err)) {
      // v8unpack not installed — try scanning the raw file with pattern matching
      return scanBslPatterns(filePath, false)
    }
    return { findings: [], ran: false }
  }

  return scanBslDir(unpacked)
}

function scanBslDir(dir: string): { findings: ScanFinding[]; ran: boolean } {
  const bslFiles = findBslFiles(dir)
  const findings: ScanFinding[] = []

  for (const file of bslFiles) {
    const content = fs.readFileSync(file, "utf-8")
    const relPath = file.replace(dir, "")
    findings.push(...matchPatterns(content, relPath))
  }

  return { findings, ran: true }
}

function scanBslPatterns(filePath: string, unpacked: boolean): { findings: ScanFinding[]; ran: boolean } {
  try {
    const content = fs.readFileSync(filePath, "utf-8")
    return { findings: matchPatterns(content, path.basename(filePath)), ran: !unpacked }
  } catch {
    return { findings: [], ran: false }
  }
}

function matchPatterns(content: string, file: string): ScanFinding[] {
  const findings: ScanFinding[] = []
  const lines = content.split("\n")

  for (const { regex, message, severity } of BSL_CRITICAL) {
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        findings.push({ tool: "epf-scanner", severity, message, file, line: i + 1 })
      }
    }
  }
  for (const { regex, message, severity } of BSL_WARNING) {
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        findings.push({ tool: "epf-scanner", severity, message, file, line: i + 1 })
      }
    }
  }
  return findings
}

function findBslFiles(dir: string): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (fs.statSync(full).isDirectory()) {
      results.push(...findBslFiles(full))
    } else if (entry.endsWith(".bsl") || entry.endsWith(".os")) {
      results.push(full)
    }
  }
  return results
}

function isNoSuchFileError(err: unknown): boolean {
  const code = (err as { code?: string }).code
  return code === "ENOENT" || String(err).includes("not found") || String(err).includes("command not found")
}
