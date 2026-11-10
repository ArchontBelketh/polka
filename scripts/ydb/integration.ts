import "./env"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import bcrypt from "bcryptjs"
import { createYdbDatabase } from "../../src/lib/ydb/database"
import { disconnectYdb } from "../../src/lib/ydb/connection"

// Synthetic fixtures only. This script never calls SMTP, Telegram, S3 or a bank.
const db = createYdbDatabase()
const prefix = `ydbtest-${randomUUID()}`
const developerId = `${prefix}-dev`, buyerId = `${prefix}-buyer`, productId = `${prefix}-product`
const jobId = `${prefix}-job`, jobModeratorId = `${prefix}-job-mod`, jobOtherId = `${prefix}-job-other`
const email = `${prefix}@example.invalid`
let fixturesStarted = false
let passed = 0
async function check(name: string, fn: () => Promise<void>) { await fn(); passed++; console.log(`PASS ${name}`) }

async function main() {
  await check("native SQL reads a real application table", async () => {
    await db.user.findUnique({ where: { id: buyerId } })
  })
  fixturesStarted = true
  await check("account create and canonical email lookup preserve password hashes", async () => {
    const passwordHash = await bcrypt.hash("SyntheticPassword123!", 8)
    await db.user.create({ data: { id: developerId, role: "DEVELOPER", email, passwordHash, agreedToTerms: true } })
    await db.user.create({ data: { id: buyerId, role: "BUYER" } })
    const user = await db.user.findUnique({ where: { email } })
    assert.equal(user?.id, developerId)
    assert.equal(user?.sessionVersion, 0)
    assert.ok(await bcrypt.compare("SyntheticPassword123!", user!.passwordHash!))
  })
  await check("developer profiles preserve one account and store portfolio data", async () => {
    const profile = await db.developerProfile.upsert({
      where: { userId: developerId }, create: {
        userId: developerId, headline: "Synthetic profile", skills: ["TypeScript", "1С"], specializations: ["BOTS"],
        portfolio: [{ title: "Synthetic project", description: "Synthetic only", url: "https://example.invalid/project" }],
      }, update: {},
    })
    assert.equal(profile.availability, "UNAVAILABLE")
    const owner = await db.user.findUnique({ where: { id: developerId }, select: { id: true, developerProfile: true } })
    assert.equal(owner?.developerProfile?.userId, developerId)
    assert.deepEqual(owner?.developerProfile?.skills, ["TypeScript", "1С"])
    assert.deepEqual(owner?.developerProfile?.portfolio, profile.portfolio)
    await db.developerProfile.upsert({ where: { userId: developerId }, create: { userId: developerId }, update: { availability: "LIMITED" } })
    assert.equal((await db.developerProfile.findUnique({ where: { userId: developerId } }))?.availability, "LIMITED")
    assert.equal(await db.developerProfile.count({ where: { userId: developerId } }), 1)
  })
  await check("concurrent duplicate emails commit exactly one account", async () => {
    const duplicateEmail = `${prefix}-race@example.invalid`
    const result = await Promise.allSettled([0, 1].map((n) => db.user.create({ data: { id: `${prefix}-race-${n}`, email: duplicateEmail } })))
    assert.equal(result.filter((r) => r.status === "fulfilled").length, 1)
    assert.equal(await db.user.count({ where: { email: duplicateEmail } }), 1)
  })
  await check("null unique values allow multiple accounts", async () => {
    assert.equal((await db.user.findUnique({ where: { id: buyerId } }))?.email, null)
    assert.equal(await db.user.count({ where: { id: { in: [buyerId, developerId] }, telegramId: null } }), 2)
  })
  await check("related rows, string lists and JSON round-trip", async () => {
    await db.product.create({ data: {
      id: productId, title: "Тестовый код YDB", slug: prefix, shortDesc: "Synthetic", fullDesc: "Integration fixture",
      category: "WEB", price: 10000, authorId: developerId, features: ["А", "Б"], screenshots: [], techStack: ["TypeScript"], xrayPassport: { synthetic: true },
    } })
    const product = await db.product.findUnique({ where: { slug: prefix }, include: { author: { select: { id: true } } } })
    assert.equal(product?.author.id, developerId)
    assert.deepEqual(product?.features, ["А", "Б"])
    assert.deepEqual(product?.xrayPassport, { synthetic: true })
    assert.ok(product?.createdAt instanceof Date)
  })
  await check("catalog specification filters match declared arrays and preserve legacy products", async () => {
    const { parseCatalogQuery, catalogWhere } = await import("../../src/lib/catalog-query")
    const parsed = parseCatalogQuery({ language: "TYPESCRIPT", platform: "LINUX", compatibility: "node 22" })
    if (!parsed.success) throw new Error(parsed.error)
    const where = { AND: [{ id: productId }, catalogWhere(parsed.value, "DRAFT")] }
    assert.equal(await db.product.count({ where: { id: productId } }), 1)
    assert.equal(await db.product.count({ where }), 0)
    await db.productSpecification.create({ data: { productId, languages: ["TYPESCRIPT", "JAVASCRIPT"], platforms: ["LINUX", "WINDOWS"], compatibility: "Node 22", supportTerms: "Synthetic terms only" } })
    assert.equal(await db.product.count({ where }), 1)
    assert.equal(await db.product.count({ where: { id: productId, specification: { is: { platforms: { has: "EXCEL" } } } } }), 0)
    const product = await db.product.findUnique({ where: { id: productId }, select: { specification: true } })
    assert.equal(product?.specification?.supportTerms, "Synthetic terms only")
  })
  await check("foreign-key validation prevents orphan writes", async () => {
    await assert.rejects(db.productFile.create({ data: { productId: `${prefix}-missing`, s3Key: "unused", fileName: "unused.zip", fileSize: 1, fileType: "SOURCE", format: "zip" } }))
  })
  await check("callback rollback keeps all money fields unchanged", async () => {
    await assert.rejects(db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: developerId }, data: { balance: { increment: 500 } } })
      await tx.product.update({ where: { id: productId }, data: { salesCount: { increment: 1 } } })
      throw new Error("intentional rollback")
    }), /intentional rollback/)
    assert.equal((await db.user.findUnique({ where: { id: developerId } }))?.balance, 0)
    assert.equal((await db.product.findUnique({ where: { id: productId } }))?.salesCount, 0)
  })
  await check("array transactions stay lazy and roll back together", async () => {
    const first = db.user.update({ where: { id: developerId }, data: { balance: { increment: 100 } } })
    assert.equal((await db.user.findUnique({ where: { id: developerId } }))?.balance, 0)
    await assert.rejects(db.$transaction([first, db.user.update({ where: { id: `${prefix}-missing` }, data: { balance: 1 } })]))
    assert.equal((await db.user.findUnique({ where: { id: developerId } }))?.balance, 0)
  })
  await check("a reset token is consumed once and increments sessionVersion once", async () => {
    await db.user.update({ where: { id: buyerId }, data: { resetTokenHash: prefix, resetTokenExpiresAt: new Date(Date.now() + 60000) } })
    const results = await Promise.all([0, 1].map(() => db.user.updateMany({
      where: { id: buyerId, resetTokenHash: prefix, resetTokenExpiresAt: { gt: new Date() } },
      data: { resetTokenHash: null, resetTokenExpiresAt: null, sessionVersion: { increment: 1 } },
    })))
    assert.equal(results.reduce((sum, result) => sum + result.count, 0), 1)
    assert.equal((await db.user.findUnique({ where: { id: buyerId } }))?.sessionVersion, 1)
  })
  await check("parallel confirmed-payment transitions credit one sale", async () => {
    const purchaseId = `${prefix}-purchase`, intentId = `${prefix}-intent`
    // Import the real handler with messaging disabled in this test process.
    process.env.DB_PROVIDER = "ydb"
    process.env.SMTP_HOST = ""
    process.env.TELEGRAM_BOT_TOKEN = ""
    const { applyPaymentOutcome } = await import("../../src/lib/payments")
    const { developerPayout } = await import("../../src/lib/earnings")
    const { payoutHoldThresholdKopecks } = await import("../../src/lib/tariffs")
    await db.purchase.create({ data: { id: purchaseId, buyerId, productId, amount: 10000 } })
    const paymentId = `${prefix}-bank`
    await db.paymentIntent.create({ data: { id: intentId, orderId: prefix, type: "purchase", payload: { purchaseId }, amount: 10000, paymentId } })
    const result = await Promise.all([0, 1].map(() => applyPaymentOutcome(intentId, paymentId, "CONFIRMED")))
    assert.equal(result.filter((outcome) => outcome.applied).length, 1)
    const expectedCredit = 10000 >= payoutHoldThresholdKopecks ? 0 : developerPayout(10000, false)
    assert.equal((await db.user.findUnique({ where: { id: developerId } }))?.balance, expectedCredit)
    assert.equal((await db.product.findUnique({ where: { id: productId } }))?.salesCount, 1)
    assert.equal((await applyPaymentOutcome(intentId, paymentId, "FAILED")).applied, false)
    assert.equal((await db.paymentIntent.findUnique({ where: { id: intentId } }))?.status, "CONFIRMED")
  })
  await check("nested support messages, reverse relations and counts", async () => {
    const ticket = await db.supportTicket.create({ data: { id: `${prefix}-ticket`, authorId: buyerId, subject: "Synthetic", category: "OTHER", messages: { create: { authorId: buyerId, text: "Synthetic" } } }, include: { messages: true, _count: { select: { messages: true } } } })
    assert.equal(ticket.messages.length, 1)
    assert.equal(ticket._count.messages, 1)
  })
  await check("relation predicates, Unicode search and aggregates", async () => {
    const purchases = await db.purchase.findMany({ where: { product: { authorId: developerId } }, include: { product: { select: { title: true } } } })
    assert.equal(purchases.length, 1)
    assert.equal(await db.product.count({ where: { id: productId, title: { contains: "ТЕСТОВЫЙ", mode: "insensitive" } } }), 1)
    const sum = await db.purchase.aggregate({ where: { productId }, _sum: { amount: true } })
    assert.equal(sum._sum.amount, 10000)
    const grouped = await db.purchase.groupBy({ by: ["status"], where: { productId }, _count: { _all: true } })
    assert.equal(grouped[0]._count._all, 1)
  })
  await check("draft retry tokens and upload preparation are durable without storage calls", async () => {
    const { createProductSubmission } = await import("../../src/lib/product-submissions")
    const { prepareProductUpload } = await import("../../src/lib/product-uploads")
    const input = { title: "Synthetic store fixture", slug: `${prefix}-store`, shortDesc: "Synthetic only", fullDesc: "Synthetic integration fixture", category: "WEB" as const, price: 19929, features: [], screenshots: [], authorId: developerId }
    const results = await Promise.all([0, 1].map(() => createProductSubmission(developerId, `${prefix}-submission`, "synthetic-fingerprint", input)))
    assert.equal(results[0].product.id, results[1].product.id)
    assert.equal(await db.product.count({ where: { slug: `${prefix}-store` } }), 1)
    const upload = { id: `${prefix}-upload`, productId: results[0].product.id, type: "source" as const, slot: 0, fileName: "app.py", fileSize: 4, contentType: "text/x-python" }
    const attempts = await Promise.all([0, 1].map(() => prepareProductUpload(developerId, upload)))
    assert.equal(attempts[0].stagingKey, attempts[1].stagingKey)
    assert.equal(await db.productFile.count({ where: { productId: upload.productId } }), 0)
  })
  await check("direct-purchase and verified-review transactions work on native YDB", async () => {
    const { requestDirectPurchase, saveVerifiedReview } = await import("../../src/lib/store-transactions")
    const product = await db.product.findUniqueOrThrow({ where: { slug: `${prefix}-store` } })
    await db.payoutProfile.create({ data: { userId: developerId, kind: "SELF_EMPLOYED", displayName: "Synthetic only", inn: "000000000000", paymentLink: "https://example.invalid/no-transfer", attestedAt: new Date() } })
    await db.productFile.create({ data: { productId: product.id, fileType: "SOURCE", s3Key: `products/${product.id}/artifacts/synthetic/app.py`, fileName: "app.py", fileSize: 4, format: ".py" } })
    await db.product.update({ where: { id: product.id }, data: { status: "APPROVED", publishedAt: new Date() } })
    const result = await Promise.all([0, 1].map(() => requestDirectPurchase(buyerId, product.id)))
    assert.equal(result.filter((item) => item.status === 201).length, 1)
    assert.equal(await db.purchase.count({ where: { productId: product.id } }), 1)
    assert.equal((await saveVerifiedReview(buyerId, product.id, 5, "Synthetic review" )).status, 403)
    // Test fixture transition only; this is not a real confirmation or transfer.
    await db.purchase.updateMany({ where: { productId: product.id, buyerId }, data: { status: "DELIVERED" } })
    const reviews = await Promise.all([0, 1].map(() => saveVerifiedReview(buyerId, product.id, 5, "Synthetic verified review")))
    assert.ok(reviews.every((item) => item.status === 201))
    assert.equal(await db.review.count({ where: { productId: product.id } }), 1)
    assert.equal((await db.product.findUnique({ where: { id: product.id } }))?.reviewCount, 1)
  })
  await check("payout reserve, rejection and financial journal roll back on native YDB", async () => {
    const { createPayoutForDeveloper, transitionPayout } = await import("../../src/lib/payouts")
    // Synthetic accounting only: no bank, receipt or transfer method is invoked.
    await db.purchase.update({ where: { id: `${prefix}-purchase` }, data: { status: "PAID", developerAmount: 8000, creditedAt: new Date(), holdUntil: null } })
    await db.user.update({ where: { id: developerId }, data: { balance: 8000 } })
    const requests = await Promise.all([0, 1].map(() => createPayoutForDeveloper(developerId)))
    const created = requests.filter((result): result is { id: string; amount: number } => "id" in result)
    assert.equal(created.length, 1)
    assert.equal(created[0].amount, 8000)
    assert.equal((await db.user.findUnique({ where: { id: developerId } }))?.balance, 0)
    await transitionPayout(created[0].id, "PROCESSING", developerId)
    const rejected = await Promise.all([0, 1].map(() => transitionPayout(created[0].id, "REJECTED", developerId)))
    assert.equal(rejected.filter((result) => result.applied).length, 1)
    assert.equal((await db.user.findUnique({ where: { id: developerId } }))?.balance, 8000)
    assert.equal((await db.purchase.findUnique({ where: { id: `${prefix}-purchase` } }))?.payoutId, null)
    await db.financialOperation.create({ data: { id: `${prefix}-journal`, kind: "TEST", referenceId: prefix, amount: 0, actorId: developerId, payload: { synthetic: true } } })
    await assert.rejects(db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: developerId }, data: { balance: { increment: 1 } } })
      await tx.financialOperation.update({ where: { id: `${prefix}-journal` }, data: { status: "APPLIED" } })
      throw new Error("intentional journal rollback")
    }), /intentional journal rollback/)
    assert.equal((await db.financialOperation.findUnique({ where: { id: `${prefix}-journal` } }))?.status, "PREPARED")
    assert.equal((await db.user.findUnique({ where: { id: developerId } }))?.balance, 8000)
  })
  await check("job publication, concurrent selection, dispute, messages and acceptance on native YDB", async () => {
    const { createJob, saveProposal, runJobCommand } = await import("../../src/lib/jobs/service")
    const { readWorkspace } = await import("../../src/lib/jobs/read")
    await db.user.create({ data: { id: jobModeratorId, role: "MODERATOR", name: "Synthetic moderator" } })
    await db.user.create({ data: { id: jobOtherId, role: "DEVELOPER", name: "Synthetic other executor" } })
    const customer = { id: buyerId, role: "BUYER" }, moderator = { id: jobModeratorId, role: "MODERATOR" }
    await createJob(customer, jobId, { title: "Synthetic job integration fixture", description: "Synthetic task description without personal or payment information for native transaction checks.", outcome: "Synthetic result and acceptance criteria only", specialization: "SCRIPTS", budgetMin: 10000, budgetMax: 20000, deadline: new Date(Date.now() + 7 * 86400000) })
    await runJobCommand(customer, jobId, { action: "SUBMIT", revision: 0 })
    await runJobCommand(moderator, jobId, { action: "APPROVE", revision: 1, reason: "Synthetic moderation check" })
    const { saveDeveloperProfile } = await import("../../src/lib/developers/profile")
    const { readDeveloperDirectory } = await import("../../src/lib/developers/directory")
    const { inviteDeveloper } = await import("../../src/lib/developers/invitations")
    await saveDeveloperProfile(developerId, { headline: `${prefix} synthetic developer`, skills: ["TypeScript"], specializations: ["SCRIPTS"], availability: "AVAILABLE", portfolio: [], listed: true })
    const directory = await readDeveloperDirectory({ q: prefix, skill: "TypeScript", specialization: "SCRIPTS", availability: "READY", page: 1 })
    assert.deepEqual(directory.items.map(item => item.id), [developerId])
    await Promise.all([0, 1].map(() => inviteDeveloper(customer, jobId, developerId)))
    assert.equal(await db.jobInvitation.count({ where: { jobId } }), 1)
    assert.equal(await db.jobNotification.count({ where: { jobId, userId: developerId } }), 1)
    for (const id of [developerId, jobOtherId]) await saveProposal({ id, role: "DEVELOPER" }, jobId, { amount: 15000, durationDays: 3, approach: "Synthetic implementation approach and verification plan", revision: 0 })
    const proposals = await db.jobProposal.findMany({ where: { jobId } })
    const selected = await Promise.allSettled(proposals.map(proposal => runJobCommand(customer, jobId, { action: "SELECT", proposalId: proposal.id, proposalRevision: proposal.revision })))
    assert.equal(selected.filter(item => item.status === "fulfilled").length, 1)
    const contract = await db.jobContract.findUniqueOrThrow({ where: { jobId } })
    const executor = { id: contract.developerId, role: "DEVELOPER" }, outsider = { id: contract.developerId === developerId ? jobOtherId : developerId, role: "DEVELOPER" }
    await assert.rejects(readWorkspace(jobId, outsider))
    await runJobCommand(executor, jobId, { action: "DISPUTE", reason: "Synthetic clarification requiring support" })
    await runJobCommand(moderator, jobId, { action: "RESUME", reason: "Synthetic clarification resolved by support" })
    await runJobCommand(executor, jobId, { action: "START" })
    const messageId = randomUUID()
    await Promise.all([0, 1].map(() => runJobCommand(customer, jobId, { action: "MESSAGE", id: messageId, text: "Synthetic private message" })))
    assert.equal(await db.jobMessage.count({ where: { jobId } }), 1)
    const deliveryId = randomUUID()
    await runJobCommand(executor, jobId, { action: "DELIVER", id: deliveryId, text: "Synthetic delivery with explicit result and verification description", attachmentIds: [] })
    await Promise.all([0, 1].map(() => runJobCommand(customer, jobId, { action: "ACCEPT", deliveryId })))
    assert.equal((await db.job.findUniqueOrThrow({ where: { id: jobId } })).status, "COMPLETED")
    for (const actor of [customer, executor]) await runJobCommand(actor, jobId, { action: "REVIEW", rating: 5, text: "Synthetic review for a completed service order" })
    assert.equal(await db.jobReview.count({ where: { jobId } }), 2)
    assert.equal((await db.jobContract.findUniqueOrThrow({ where: { jobId } })).amount, 15000)
  })
  console.log(`YDB integration checks passed: ${passed}.`)
}

async function cleanup() {
  if (!fixturesStarted) return
  const dispute = await db.jobDispute.findUnique({ where: { jobId } })
  const { jobSignalKey } = await import("../../src/lib/developers/metrics")
  const proposals = await db.jobProposal.findMany({ where: { jobId }, select: { id: true } })
  const invitations = await db.jobInvitation.findMany({ where: { jobId }, select: { id: true } })
  const signalIds = ["SELECTION", "COMPLETION", "DISPUTE"].map(kind => jobSignalKey(kind, jobId))
  signalIds.push(...proposals.map(row => jobSignalKey("PROPOSAL", row.id)), ...invitations.map(row => jobSignalKey("INVITATION", row.id)))
  await db.exposureEvent.deleteMany({ where: { id: { in: signalIds } } })
  await db.jobInvitation.deleteMany({ where: { jobId } })
  await db.developerListing.deleteMany({ where: { userId: { in: [developerId, jobOtherId] } } })
  await db.jobNotification.deleteMany({ where: { jobId } })
  await db.jobMessage.deleteMany({ where: { jobId } })
  await db.jobReview.deleteMany({ where: { jobId } })
  await db.jobDelivery.deleteMany({ where: { jobId } })
  await db.jobAttachment.deleteMany({ where: { jobId } })
  await db.jobStatusLog.deleteMany({ where: { jobId } })
  await db.jobDispute.deleteMany({ where: { jobId } })
  await db.jobContract.deleteMany({ where: { jobId } })
  await db.jobProposal.deleteMany({ where: { jobId } })
  await db.job.deleteMany({ where: { id: jobId } })
  if (dispute) await db.supportTicket.delete({ where: { id: dispute.ticketId } })
  await db.user.deleteMany({ where: { id: { in: [jobModeratorId, jobOtherId] } } })
  await db.financialOperation.deleteMany({ where: { id: `${prefix}-journal` } })
  await db.paymentIntent.deleteMany({ where: { id: `${prefix}-intent` } })
  await db.supportTicket.deleteMany({ where: { id: `${prefix}-ticket` } })
  await db.purchase.deleteMany({ where: { productId } })
  await db.product.deleteMany({ where: { id: productId } })
  const extra = await db.product.findMany({ where: { slug: `${prefix}-store` }, select: { id: true } })
  for (const product of extra) {
    await db.purchase.deleteMany({ where: { productId: product.id } })
    await db.review.deleteMany({ where: { productId: product.id } })
    await db.product.delete({ where: { id: product.id } })
  }
  await db.payout.deleteMany({ where: { developerId } })
  await db.user.deleteMany({ where: { id: { in: [developerId, buyerId, `${prefix}-race-0`, `${prefix}-race-1`] } } })
  console.log("Synthetic YDB fixtures removed.")
}

main().catch((error) => { console.error(`YDB integration stopped after ${passed} checks: ${error instanceof Error ? error.message : "unknown error"}`); process.exitCode = 1 })
  .finally(async () => { try { await cleanup() } catch { console.error(`Fixture cleanup failed; exact prefix: ${prefix}`); process.exitCode = 1 } finally { await disconnectYdb() } })
