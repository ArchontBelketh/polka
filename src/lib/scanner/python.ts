import { exec } from "child_process"
import { promisify } from "util"
import type { ScanFinding } from "@/types"

const execAsync = promisify(exec)

interface BanditResult {
  results: Array<{
    filename: string
    line_number: number
    issue_text: string
    issue_severity: string
  }>
}

export async function runBandit(dir: string): Promise<{ findings: ScanFinding[]; ran: boolean }> {
  try {
    const { stdout } = await execAsync(
      `bandit -r "${dir}" -f json -q`,
      { timeout: 60_000 },
    )
    const parsed: BanditResult = JSON.parse(stdout)
    const findings: ScanFinding[] = parsed.results.map((r) => ({
      tool: "bandit",
      severity: r.issue_severity === "HIGH" ? "critical" : "warning",
      message: r.issue_text,
      file: r.filename.replace(dir, ""),
      line: r.line_number,
    }))
    return { findings, ran: true }
  } catch (err: unknown) {
    if (isNoSuchFileError(err)) return { findings: [], ran: false }
    // bandit exits with code 1 when findings exist — stdout still has JSON
    const stdout = (err as { stdout?: string }).stdout ?? ""
    if (stdout) {
      try {
        const parsed: BanditResult = JSON.parse(stdout)
        const findings: ScanFinding[] = parsed.results.map((r) => ({
          tool: "bandit",
          severity: r.issue_severity === "HIGH" ? "critical" : "warning",
          message: r.issue_text,
          file: r.filename.replace(dir, ""),
          line: r.line_number,
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
