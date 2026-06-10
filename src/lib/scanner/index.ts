import fs from "fs"
import path from "path"
import os from "os"
import { createHash } from "crypto"
import { db } from "@/lib/db"
import { getObjectBuffer } from "@/lib/s3"
import { runBandit } from "./python"
import { runSemgrep } from "./semgrep"
import { scanEpf } from "./epf"
import { scanExcel } from "./excel"
import { checkEntropy } from "./entropy"
import { checkNetworkExtra } from "./network-extra"
import { checkDuplicateHash } from "./duplicate"
import { safeUnzip } from "./zip-safe"
import { checkFileHash } from "@/lib/auto-moderation/virustotal"
import { runAutoModeration } from "@/lib/auto-moderation"
import type { ScanFinding } from "@/types"

const s3Configured =
  !!process.env.YANDEX_S3_ACCESS_KEY && !!process.env.YANDEX_S3_SECRET_KEY

// File extensions eligible for entropy / network-extra analysis
const EXTRA_ANALYSIS_EXTS = new Set([".py", ".js", ".ts", ".jsx", ".tsx", ".bsl", ".vbs", ".ps1", ".bat", ".sh"])

// Size threshold for "unusually large" warning (independent of zip-bomb check)
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

export async function runScan(productId: string): Promise<void> {
  await db.scanResult.upsert({
    where: { productId },
    update: { status: "PENDING", findings: [], scannedAt: null, toolsRun: [] },
    create: { productId, status: "PENDING", findings: [], toolsRun: [] },
  })

  const product = await db.product.findUnique({
    where: { id: productId },
    include: { files: true },
  })

  if (!product || product.files.length === 0) {
    await db.scanResult.update({
      where: { productId },
      data: { status: "CLEAN", scannedAt: new Date(), toolsRun: ["no-files"] },
    })
    await runAutoModeration(productId)
    return
  }

  // S3 not configured — skip file scan, run auto-moderation on metadata only
  if (!s3Configured) {
    await db.scanResult.update({
      where: { productId },
      data: { status: "CLEAN", scannedAt: new Date(), toolsRun: ["skipped-no-s3"] },
    })
    await runAutoModeration(productId)
    return
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "polka-scan-"))
  const allFindings: ScanFinding[] = []
  const toolsRan = new Set<string>()

  try {
    for (const file of product.files) {
      if (file.s3Key.startsWith("local/")) continue

      const buffer = await getObjectBuffer(file.s3Key)
      const localPath = path.join(tmpDir, file.fileName)
      fs.writeFileSync(localPath, buffer)

      const ext = path.extname(file.fileName).toLowerCase()

      // ── Size anomaly ─────────────────────────────────────────────────────
      if (file.fileSize > MAX_FILE_SIZE_BYTES) {
        allFindings.push({
          tool: "size-check",
          severity: "warning",
          message: `Аномально большой файл: ${(file.fileSize / 1024 / 1024).toFixed(0)} МБ (обычные инструменты < 50 МБ)`,
          file: file.fileName,
        })
        toolsRan.add("size-check")
      }

      // ── VirusTotal hash check ─────────────────────────────────────────────
      const sha256 = createHash("sha256").update(buffer).digest("hex")
      const vtResult = await checkFileHash(sha256, file.fileName)
      if (vtResult.verdict === "malicious") {
        allFindings.push({
          tool: "virustotal",
          severity: "critical",
          message: `VirusTotal: файл флагируют ${vtResult.detections} AV-движков — вредоносный`,
          file: file.fileName,
        })
        toolsRan.add("virustotal")
      } else if (vtResult.verdict === "suspicious") {
        allFindings.push({
          tool: "virustotal",
          severity: "warning",
          message: `VirusTotal: подозрительный файл — ${vtResult.details ?? vtResult.detections + " флагов"}`,
          file: file.fileName,
        })
        toolsRan.add("virustotal")
      } else if (vtResult.known) {
        toolsRan.add("virustotal")
      }

      // ── Duplicate detection (SHA-256) ─────────────────────────────────────
      const dupeFindings = await checkDuplicateHash(sha256, productId, product.authorId, file.fileName)
      if (dupeFindings.length > 0) {
        allFindings.push(...dupeFindings)
        toolsRan.add("duplicate-check")
      }
      // Persist the hash so future uploads can be matched against this file
      await db.productFile.update({ where: { id: file.id }, data: { sha256 } }).catch(() => {})

      // ── ZIP: safe streaming extraction with multi-layer bomb protection ──
      let workDir = tmpDir
      if (ext === ".zip") {
        const unzipResult = await safeUnzip(localPath, tmpDir)
        allFindings.push(...unzipResult.findings)
        if (unzipResult.findings.length > 0) toolsRan.add("size-check")

        if (!unzipResult.ok) {
          // Bomb detected — skip further analysis of this file's contents
          continue
        }
        workDir = unzipResult.extractedDir
      }

      // ── Python / ZIP: bandit + semgrep ────────────────────────────────────
      if ([".py", ".zip"].includes(ext)) {
        const { findings, ran } = await runBandit(workDir)
        allFindings.push(...findings)
        if (ran) toolsRan.add("bandit")

        const sg = await runSemgrep(workDir)
        allFindings.push(...sg.findings)
        if (sg.ran) toolsRan.add("semgrep")
      }

      // ── 1C external processing ────────────────────────────────────────────
      if ([".epf", ".erf"].includes(ext)) {
        const { findings, ran } = await scanEpf(localPath, tmpDir)
        allFindings.push(...findings)
        if (ran) toolsRan.add("epf-scanner")
      }

      // ── Excel macros ──────────────────────────────────────────────────────
      if ([".xlsm", ".xls", ".xlam"].includes(ext)) {
        const { findings, ran } = await scanExcel(localPath)
        allFindings.push(...findings)
        if (ran) toolsRan.add("olevba")
      }

      // ── JS/TS: semgrep ────────────────────────────────────────────────────
      if ([".js", ".ts", ".jsx", ".tsx"].includes(ext)) {
        const sg = await runSemgrep(workDir)
        allFindings.push(...sg.findings)
        if (sg.ran) toolsRan.add("semgrep")
      }

      // ── Entropy + network-extra for text files ────────────────────────────
      if (EXTRA_ANALYSIS_EXTS.has(ext)) {
        const ef = checkEntropy(localPath)
        allFindings.push(...ef)
        if (ef.length > 0) toolsRan.add("entropy")

        const nf = checkNetworkExtra(localPath)
        allFindings.push(...nf)
        if (nf.length > 0) toolsRan.add("network-extra")
      }

      // ── For extracted zip contents: entropy + network-extra recursively ───
      if (ext === ".zip" && workDir !== tmpDir) {
        for (const extractedFile of walkTextFiles(workDir)) {
          allFindings.push(...checkEntropy(extractedFile))
          allFindings.push(...checkNetworkExtra(extractedFile))
        }
        if (allFindings.some((f) => (f as ScanFinding & { tool?: string }).tool === "entropy"))
          toolsRan.add("entropy")
        if (allFindings.some((f) => (f as ScanFinding & { tool?: string }).tool === "network-extra"))
          toolsRan.add("network-extra")
      }
    }

    const hasCritical = allFindings.some((f) => f.severity === "critical")
    const hasWarning = allFindings.some((f) => f.severity === "warning")
    const status = hasCritical ? "BLOCKED" : hasWarning ? "WARNING" : "CLEAN"
    const toolsRunArr = toolsRan.size > 0 ? Array.from(toolsRan) : ["no-tools-installed"]

    await db.scanResult.update({
      where: { productId },
      data: {
        status,
        findings: allFindings as object[],
        scannedAt: new Date(),
        toolsRun: toolsRunArr,
      },
    })

    if (status === "BLOCKED") {
      await db.product.update({
        where: { id: productId },
        data: { status: "SCAN_FAILED" },
      })
    } else {
      await runAutoModeration(productId)
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function walkTextFiles(dir: string): string[] {
  const results: string[] = []
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) results.push(...walkTextFiles(full))
      else if (EXTRA_ANALYSIS_EXTS.has(path.extname(entry.name).toLowerCase())) {
        results.push(full)
      }
    }
  } catch {
    // Ignore unreadable directories
  }
  return results
}
