import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { runCodeAudit } from "@/lib/ai-review/code-audit"
import { deleteObject } from "@/lib/s3"
import { notifyServiceReportReady } from "@/lib/notify"
import { recordCronRun } from "@/lib/cron-heartbeat"
import type { XrayReport } from "@/lib/xray/types"

export const maxDuration = 60

// Выполняет оплаченные AI-аудиты (ТЗ 11.1). Экспертные услуги крон не трогает.
// curl -X POST http://localhost:3000/api/cron/service-audit -H "x-cron-secret: $CRON_SECRET"
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || cronSecret.length < 32) {
    console.error("CRON_SECRET is not set or too short — cron endpoint is disabled")
    return Response.json({ error: "Service unavailable" }, { status: 503 })
  }
  if (req.headers.get("x-cron-secret") !== cronSecret) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const pending = await db.serviceOrder.findMany({
    where: { kind: "AI_AUDIT", status: "PAID" },
    take: 5,
    orderBy: { paidAt: "asc" },
  })

  const results = await Promise.allSettled(
    pending.map(async (order) => {
      const result = await runCodeAudit({
        codeS3Key: order.codeS3Key,
        codeFileName: order.codeFileName,
        brief: order.brief,
        xrayReport: order.xrayReport ? (order.xrayReport as unknown as XrayReport) : null,
      })

      if (!result) {
        // Не удалось — отдаём оператору (не зацикливаем крон).
        await db.serviceOrder.update({ where: { id: order.id }, data: { status: "IN_PROGRESS" } })
        return { id: order.id, status: "FAILED" }
      }

      const now = new Date()
      await db.serviceOrder.update({
        where: { id: order.id },
        data: { status: "REPORT_READY", aiResult: result as object, reportReadyAt: now },
      })
      void notifyServiceReportReady({ orderId: order.id, kind: order.kind, email: order.email })

      // Код удаляется после сдачи отчёта (ТЗ 11.4).
      if (order.codeS3Key) {
        await deleteObject(order.codeS3Key).catch(() => {})
        await db.serviceOrder.update({ where: { id: order.id }, data: { codeDeletedAt: now } })
      }
      return { id: order.id, status: "DONE" }
    }),
  )

  const processed = results.map((r) => (r.status === "fulfilled" ? r.value : { status: "error" }))
  await recordCronRun("service-audit")
  return Response.json({ processed })
}
