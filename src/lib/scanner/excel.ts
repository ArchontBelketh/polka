import { exec } from "child_process"
import { promisify } from "util"
import type { ScanFinding } from "@/types"
import { VBA_CRITICAL_PATTERNS, VBA_WARNING_PATTERNS } from "./patterns"

const execAsync = promisify(exec)

interface OleVbaResult {
  type: string
  filename: string
  macros: Array<{
    vba_filename: string
    code: string
  }>
}

export async function scanExcel(filePath: string): Promise<{ findings: ScanFinding[]; ran: boolean }> {
  try {
    const { stdout } = await execAsync(
      `olevba --json "${filePath}"`,
      { timeout: 30_000 },
    )
    const parsed: OleVbaResult = JSON.parse(stdout)
    const findings: ScanFinding[] = []

    for (const macro of parsed.macros ?? []) {
      const lines = macro.code.split("\n")
      for (const { regex, message, severity } of VBA_CRITICAL_PATTERNS) {
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            findings.push({ tool: "olevba", severity, message, file: macro.vba_filename, line: i + 1 })
          }
        }
      }
      for (const { regex, message, severity } of VBA_WARNING_PATTERNS) {
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            findings.push({ tool: "olevba", severity, message, file: macro.vba_filename, line: i + 1 })
          }
        }
      }
    }
    return { findings, ran: true }
  } catch (err: unknown) {
    if (isNoSuchFileError(err)) return { findings: [], ran: false }
    return { findings: [], ran: false }
  }
}

function isNoSuchFileError(err: unknown): boolean {
  const code = (err as { code?: string }).code
  return code === "ENOENT" || String(err).includes("not found") || String(err).includes("command not found")
}
