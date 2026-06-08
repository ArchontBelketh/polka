import { exec } from "child_process"
import { promisify } from "util"
import type { ScanFinding } from "@/types"

const execAsync = promisify(exec)

interface SemgrepResult {
  results: Array<{
    check_id: string
    path: string
    start: { line: number }
    extra: { message: string; severity: string }
  }>
}

export async function runSemgrep(dir: string): Promise<{ findings: ScanFinding[]; ran: boolean }> {
  try {
    const { stdout } = await execAsync(
      `semgrep --json --config=auto "${dir}"`,
      { timeout: 120_000 },
    )
    const parsed: SemgrepResult = JSON.parse(stdout)
    const findings: ScanFinding[] = parsed.results.map((r) => ({
      tool: "semgrep",
      severity: r.extra.severity === "ERROR" ? "critical" : "warning",
      message: `[${r.check_id}] ${r.extra.message}`,
      file: r.path.replace(dir, ""),
      line: r.start.line,
    }))
    return { findings, ran: true }
  } catch (err: unknown) {
    if (isNoSuchFileError(err)) return { findings: [], ran: false }
    const stdout = (err as { stdout?: string }).stdout ?? ""
    if (stdout) {
      try {
        const parsed: SemgrepResult = JSON.parse(stdout)
        const findings: ScanFinding[] = parsed.results.map((r) => ({
          tool: "semgrep",
          severity: r.extra.severity === "ERROR" ? "critical" : "warning",
          message: `[${r.check_id}] ${r.extra.message}`,
          file: r.path.replace(dir, ""),
          line: r.start.line,
        }))
        return { findings, ran: true }
      } catch { /* ignore */ }
    }
    return { findings: [], ran: false }
  }
}

function isNoSuchFileError(err: unknown): boolean {
  const code = (err as { code?: string }).code
  return code === "ENOENT" || String(err).includes("not found") || String(err).includes("command not found")
}
