import { db } from "@/lib/db"
import type { ContentFlags } from "./ai-review"

export type Decision =
  | "AUTO_APPROVE"
  | "AUTO_APPROVE_MONITOR"
  | "AUTO_REJECT"
  | "QUEUE_LOW"
  | "QUEUE_HIGH"
  | "QUEUE_URGENT"

export interface ScoreResult {
  score: number
  decision: Decision
  factors: Array<{ name: string; delta: number; reason: string }>
}

export async function computeRiskScore(
  productId: string,
  contentFlags: ContentFlags | null,
): Promise<ScoreResult> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      authorId: true,
      files: { select: { fileName: true } },
      scanResult: { select: { status: true, findings: true } },
    },
  })

  if (!product) {
    return {
      score: 100,
      decision: "QUEUE_URGENT",
      factors: [{ name: "error", delta: 100, reason: "Продукт не найден" }],
    }
  }

  const factors: Array<{ name: string; delta: number; reason: string }> = []
  let score = 0

  // ── BLOCKED → immediate reject ───────────────────────────────────────────
  if (product.scanResult?.status === "BLOCKED") {
    return {
      score: 100,
      decision: "AUTO_REJECT",
      factors: [{ name: "scan_critical", delta: 100, reason: "Критические находки сканера" }],
    }
  }

  // ── Base score by file type ──────────────────────────────────────────────
  for (const file of product.files) {
    const ext = file.fileName.split(".").pop()?.toLowerCase() ?? ""
    if (["xlsm", "xlam", "xls"].includes(ext)) {
      factors.push({ name: "base_excel_macro", delta: 15, reason: "Excel с потенциальными макросами" })
      score += 15
      break
    }
    if (["epf", "erf"].includes(ext)) {
      factors.push({ name: "base_1c", delta: 10, reason: "Внешняя обработка 1С" })
      score += 10
      break
    }
    if (["py", "js", "ts"].includes(ext)) {
      factors.push({ name: "base_script", delta: 5, reason: "Исполняемый скрипт" })
      score += 5
      break
    }
    if (ext === "zip") {
      factors.push({ name: "base_archive", delta: 8, reason: "Архив" })
      score += 8
      break
    }
  }

  // ── Scan warnings ────────────────────────────────────────────────────────
  const findings = (product.scanResult?.findings ?? []) as Array<{ severity: string }>
  const warningCount = findings.filter((f) => f.severity === "warning").length
  if (warningCount >= 3) {
    factors.push({ name: "scan_warnings_many", delta: 30, reason: `${warningCount} предупреждений сканера` })
    score += 30
  } else if (warningCount >= 1) {
    factors.push({ name: "scan_warnings", delta: 15, reason: `${warningCount} предупреждени${warningCount === 1 ? "е" : "я"} сканера` })
    score += 15
  }

  // ── Developer trust tier ─────────────────────────────────────────────────
  const [approvedCount, violationCount] = await Promise.all([
    db.product.count({ where: { authorId: product.authorId, status: "APPROVED" } }),
    db.product.count({ where: { authorId: product.authorId, status: { in: ["REJECTED", "SUSPENDED"] } } }),
  ])

  if (violationCount > 0) {
    factors.push({ name: "developer_violations", delta: 25, reason: "В истории разработчика есть нарушения" })
    score += 25
  } else if (approvedCount >= 3) {
    factors.push({ name: "developer_verified", delta: -20, reason: "Проверенный разработчик (3+ одобренных)" })
    score -= 20
  } else if (approvedCount >= 1) {
    factors.push({ name: "developer_trusted", delta: -10, reason: "Надёжный разработчик (1-2 одобренных)" })
    score -= 10
  }

  // ── AI content flags ─────────────────────────────────────────────────────
  if (contentFlags && contentFlags.provider !== "skipped") {
    if (contentFlags.mismatch && contentFlags.suspicious) {
      factors.push({
        name: "ai_both_flags",
        delta: 40,
        reason: `AI: несоответствие и подозрительный контент${contentFlags.reasons.length ? " — " + contentFlags.reasons.join("; ") : ""}`,
      })
      score += 40
    } else if (contentFlags.mismatch || contentFlags.suspicious) {
      factors.push({
        name: "ai_one_flag",
        delta: 20,
        reason: `AI: ${contentFlags.reasons.join("; ") || (contentFlags.mismatch ? "несоответствие" : "подозрительный контент")}`,
      })
      score += 20
    }
  }

  score = Math.max(0, Math.min(100, score))
  const decision = scoreToDecision(score, warningCount > 0)
  return { score, decision, factors }
}

function scoreToDecision(score: number, hasWarnings: boolean): Decision {
  if (score > 85) return "QUEUE_URGENT"
  if (score > 60) return "QUEUE_HIGH"
  if (score > 20) return "QUEUE_LOW"
  if (hasWarnings) return "AUTO_APPROVE_MONITOR"
  return "AUTO_APPROVE"
}
