import fs from "fs"
import path from "path"
import os from "os"
import { exec } from "child_process"
import { promisify } from "util"
import { db } from "@/lib/db"
import { getObjectBuffer } from "@/lib/s3"
import { runBandit } from "./python"
import { runSemgrep } from "./semgrep"
import { scanEpf } from "./epf"
import { scanExcel } from "./excel"
import type { ScanFinding } from "@/types"

const execAsync = promisify(exec)

const s3Configured =
  !!process.env.YANDEX_S3_ACCESS_KEY && !!process.env.YANDEX_S3_SECRET_KEY

export async function runScan(productId: string): Promise<void> {
  // Mark as pending
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
    await db.product.update({ where: { id: productId }, data: { status: "PENDING" } })
    return
  }

  // S3 not configured — skip file scan, pass automatically
  if (!s3Configured) {
    await db.scanResult.update({
      where: { productId },
      data: { status: "CLEAN", scannedAt: new Date(), toolsRun: ["skipped-no-s3"] },
    })
    await db.product.update({ where: { id: productId }, data: { status: "PENDING" } })
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

      // Unzip if needed
      const workDir = localPath.endsWith(".zip") ? await unzip(localPath, tmpDir) : tmpDir

      const ext = path.extname(file.fileName).toLowerCase()

      if ([".py", ".zip"].includes(ext)) {
        const { findings, ran } = await runBandit(workDir)
        allFindings.push(...findings)
        if (ran) toolsRan.add("bandit")

        const sg = await runSemgrep(workDir)
        allFindings.push(...sg.findings)
        if (sg.ran) toolsRan.add("semgrep")
      }

      if ([".epf", ".erf"].includes(ext)) {
        const { findings, ran } = await scanEpf(localPath, tmpDir)
        allFindings.push(...findings)
        if (ran) toolsRan.add("epf-scanner")
      }

      if ([".xlsm", ".xls", ".xlam"].includes(ext)) {
        const { findings, ran } = await scanExcel(localPath)
        allFindings.push(...findings)
        if (ran) toolsRan.add("olevba")
      }

      // Universal semgrep for JS/TS
      if ([".js", ".ts", ".jsx", ".tsx"].includes(ext)) {
        const sg = await runSemgrep(workDir)
        allFindings.push(...sg.findings)
        if (sg.ran) toolsRan.add("semgrep")
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

    // Update product status based on scan result
    if (status === "BLOCKED") {
      await db.product.update({
        where: { id: productId },
        data: { status: "SCAN_FAILED" },
      })
    } else {
      // CLEAN or WARNING → goes to manual moderation
      await db.product.update({
        where: { id: productId },
        data: { status: "PENDING" },
      })
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

async function unzip(zipPath: string, outDir: string): Promise<string> {
  const dest = path.join(outDir, "unzipped")
  fs.mkdirSync(dest, { recursive: true })
  try {
    await execAsync(`unzip -o "${zipPath}" -d "${dest}"`, { timeout: 30_000 })
  } catch {
    // unzip not available or failed — return original dir
    return outDir
  }
  return dest
}
