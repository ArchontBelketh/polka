import { db } from "@/lib/db"
import { reviewProductContent, reviewVersionChangelog, type ContentFlags } from "./ai-review"
import { computeRiskScore } from "./risk-score"
import {
  notifyProductAutoApproved,
  notifyProductAutoRejected,
  notifyNewVersion,
} from "@/lib/notify"

export async function runAutoModeration(productId: string): Promise<void> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      title: true,
      slug: true,
      files: { select: { id: true } },
      author: { select: { telegramId: true, email: true } },
      scanResult: { select: { findings: true, toolsRun: true } },
    },
  })
  if (!product) return

  // Layer 2: AI content review (gracefully skipped when not configured)
  const contentFlags = await reviewProductContent(productId)

  // Layer 3: Risk score + decision
  const { score, decision, factors } = await computeRiskScore(productId, contentFlags)

  const factorsSummary = factors
    .map((f) => `${f.name}(${f.delta >= 0 ? "+" : ""}${f.delta})`)
    .join(", ")

  // Prompt injection warning prefix for moderation log
  const injectionNote =
    contentFlags.promptInjection
      ? `⚠ PROMPT INJECTION DETECTED: «${(contentFlags.injectionText ?? "").slice(0, 120)}» | `
      : ""

  await db.product.update({
    where: { id: productId },
    data: {
      riskScore: score,
      autoDecision: decision,
      aiReviewFlags: contentFlags as object,
    },
  })

  if (decision === "AUTO_APPROVE" || decision === "AUTO_APPROVE_MONITOR") {
    await db.product.update({
      where: { id: productId },
      data: { status: "APPROVED", publishedAt: new Date() },
    })
    await db.moderationLog.create({
      data: {
        productId,
        action: "AUTO_APPROVED",
        comment: `${injectionNote}score=${score}, decision=${decision}. ${factorsSummary}`,
      },
    })
    await notifyProductAutoApproved({
      developerTelegramId: product.author.telegramId,
      developerEmail: product.author.email,
      productTitle: product.title,
      productSlug: product.slug,
    })
  } else if (decision === "AUTO_REJECT") {
    await db.product.update({ where: { id: productId }, data: { status: "SCAN_FAILED" } })
    const criticalReasons = (
      (product.scanResult?.findings as Array<{ message: string; severity: string }>) ?? []
    )
      .filter((f) => f.severity === "critical")
      .map((f) => f.message)
    await db.moderationLog.create({
      data: {
        productId,
        action: "AUTO_REJECTED",
        comment: `${injectionNote}score=${score}. ${criticalReasons.join("; ") || "критические находки"}`,
      },
    })
    await notifyProductAutoRejected({
      developerTelegramId: product.author.telegramId,
      developerEmail: product.author.email,
      productTitle: product.title,
      reasons: criticalReasons,
    })
  } else {
    // QUEUE_LOW / QUEUE_HIGH / QUEUE_URGENT → manual review
    await db.product.update({ where: { id: productId }, data: { status: "PENDING" } })

    // If no coverage tools were available, note it explicitly
    const toolsRun = product.scanResult?.toolsRun ?? []
    const coverageNote =
      product.files.length > 0 &&
      !toolsRun.some((t) =>
        ["bandit", "semgrep", "olevba", "epf-scanner", "virustotal", "entropy", "network-extra"].includes(t)
      ) &&
      contentFlags.provider === "skipped"
        ? " | ⚠ Нет инструментов проверки (ручная очередь)"
        : ""

    await db.moderationLog.create({
      data: {
        productId,
        action: "QUEUED",
        comment: `${injectionNote}score=${score}, decision=${decision}. ${factorsSummary}${coverageNote}`,
      },
    })
  }
}

export async function runVersionAutoModeration(versionId: string): Promise<void> {
  const version = await db.productVersion.findUnique({
    where: { id: versionId },
    include: {
      product: {
        select: { id: true, status: true, title: true, slug: true, authorId: true },
      },
    },
  })
  if (!version) return

  const product = version.product
  if (product.status !== "APPROVED") return

  // Developer must be "verified": 3+ approved products, 0 violations
  const [approvedCount, violationCount] = await Promise.all([
    db.product.count({ where: { authorId: product.authorId, status: "APPROVED" } }),
    db.product.count({
      where: { authorId: product.authorId, status: { in: ["REJECTED", "SUSPENDED"] } },
    }),
  ])
  if (violationCount > 0 || approvedCount < 3) return

  // AI changelog review (skipped gracefully if not configured)
  if (version.changelog) {
    const { valid } = await reviewVersionChangelog(versionId)
    if (!valid) return
  }

  await db.productVersion.update({
    where: { id: versionId },
    data: { status: "APPROVED", autoApproved: true },
  })

  const purchases = await db.purchase.findMany({
    where: { productId: product.id, status: { in: ["PAID", "DELIVERED"] } },
    select: { buyer: { select: { telegramId: true, email: true } } },
  })

  await notifyNewVersion({
    productTitle: product.title,
    productSlug: product.slug,
    version: version.version,
    changelog: version.changelog,
    buyers: purchases.map((p) => ({ telegramId: p.buyer.telegramId, email: p.buyer.email })),
  })
}
