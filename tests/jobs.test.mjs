import test from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { loadModule } from "./helpers/load-module.mjs"
import { storeFixture } from "./helpers/store-fixture.mjs"

const customer = { id: "customer", role: "BUYER" }, developer = { id: "developer", role: "DEVELOPER" }, other = { id: "other", role: "DEVELOPER" }, moderator = { id: "moderator", role: "MODERATOR" }
const fields = () => ({ title: "Автоматизация тестового отчёта", description: "Нужно преобразовать входные данные и сформировать итоговый отчёт с проверкой строк.", outcome: "Файл отчёта и инструкция с воспроизводимым примером проверки.", specialization: "SCRIPTS", budgetMin: 10000, budgetMax: 20000, deadline: new Date(Date.now() + 7 * 86400000) })
function fixture() {
  const f = storeFixture({ serializeWrites: true })
  for (const actor of [customer, developer, other, moderator]) f.seed("user", { ...actor, email: `${actor.id}@private.example`, passwordHash: "must-never-leak" })
  const mocks = { "@/lib/db": { db: f.db } }
  return { ...f, ...loadModule("src/lib/jobs/service.ts", { mocks }), ...loadModule("src/lib/jobs/read.ts", { mocks }), job: () => f.state().job[0], proposal: () => f.state().jobProposal[0] }
}
async function open(f) {
  const id = randomUUID()
  await f.createJob(customer, id, fields())
  await f.runJobCommand(customer, id, { action: "SUBMIT", revision: 0 })
  await f.runJobCommand(moderator, id, { action: "APPROVE", revision: 1, reason: "Публичные условия проверены" })
  return id
}
async function selected(f) {
  const id = await open(f)
  await f.saveProposal(developer, id, { amount: 18550, durationDays: 3, approach: "Подготовлю преобразование данных, тестовый пример и документацию.", revision: 0 })
  await f.runJobCommand(customer, id, { action: "SELECT", proposalId: f.proposal().id, proposalRevision: 1 })
  return id
}

test("one account completes an order through revision, acceptance and two independent reviews", async () => {
  const f = fixture(), id = await selected(f)
  const snapshot = structuredClone(f.state().jobContract[0])
  await f.runJobCommand(developer, id, { action: "START" })
  const messageId = randomUUID()
  await f.runJobCommand(customer, id, { action: "MESSAGE", id: messageId, text: "Проверим результат на примере." })
  await f.runJobCommand(customer, id, { action: "MESSAGE", id: messageId, text: "Проверим результат на примере." })
  assert.equal(f.state().jobMessage.length, 1)
  const first = randomUUID()
  await f.runJobCommand(developer, id, { action: "DELIVER", id: first, text: "Подготовлен первый вариант с тестовым примером и инструкцией.", attachmentIds: [] })
  await f.runJobCommand(customer, id, { action: "REVISION", deliveryId: first, reason: "Добавьте обработку пустых строк входного набора" })
  assert.equal(f.job().status, "IN_PROGRESS")
  const final = randomUUID()
  await f.runJobCommand(developer, id, { action: "DELIVER", id: final, text: "Добавлена обработка пустых строк, пример и инструкция обновлены.", attachmentIds: [] })
  await f.runJobCommand(customer, id, { action: "ACCEPT", deliveryId: final })
  await f.runJobCommand(customer, id, { action: "ACCEPT", deliveryId: final })
  await f.runJobCommand(customer, id, { action: "REVIEW", rating: 5, text: "Работа принята, пример и инструкция соответствуют условиям." })
  await f.runJobCommand(developer, id, { action: "REVIEW", rating: 4, text: "Требования сформулированы понятно, приёмка прошла по критериям." })
  assert.equal(f.job().status, "COMPLETED")
  assert.equal(f.state().jobDelivery.length, 2)
  assert.equal(f.state().jobReview.length, 2)
  assert.equal(f.state().jobStatusLog.filter(event => event.action === "ACCEPT").length, 1)
  assert.deepEqual(f.state().jobContract[0], snapshot)
  assert.equal(f.state().purchase.length + f.state().payout.length + f.state().financialOperation.length, 0)
  assert.ok(f.state().jobNotification.some(event => event.userId === developer.id))
})

test("concurrent creation and a lost commit reply recover the same draft without orphan events", async () => {
  const f = fixture(), id = randomUUID(), input = fields()
  f.control.commitError = true
  const results = await Promise.all(Array.from({ length: 8 }, () => f.createJob(customer, id, input)))
  assert.ok(results.every(result => result.jobId === id))
  assert.equal(f.state().job.length, 1)
  assert.equal(f.state().jobStatusLog.length, 1)
  await assert.rejects(() => f.createJob(other, id, input), /идентификатор/)
  await assert.rejects(() => f.createJob(customer, id, { ...input, deadline: new Date(input.deadline.getTime() + 1000) }), /идентификатор/)
})

test("draft edits and moderation enforce ownership, fresh roles and revisions", async () => {
  const f = fixture(), id = randomUUID(); await f.createJob(customer, id, fields())
  await assert.rejects(() => f.runJobCommand(other, id, { action: "EDIT", revision: 0, fields: fields() }), /доступа/)
  await f.runJobCommand(customer, id, { action: "EDIT", revision: 0, fields: { ...fields(), title: "Изменённая задача для проверки" } })
  await assert.rejects(() => f.runJobCommand(customer, id, { action: "EDIT", revision: 0, fields: fields() }), /изменился/)
  await f.runJobCommand(customer, id, { action: "SUBMIT", revision: 1 })
  await assert.rejects(() => f.runJobCommand(customer, id, { action: "APPROVE", revision: 2, reason: "Самостоятельное одобрение" }), /модератора/)
  f.state().user.find(user => user.id === moderator.id).role = "BUYER"
  await assert.rejects(() => f.runJobCommand(moderator, id, { action: "APPROVE", revision: 2, reason: "Устаревшая роль модератора" }), /модератора/)
  assert.equal(f.job().publicationStatus, "PENDING")
})

test("proposal prices and history are scoped to the owner, staff and their own developer", async () => {
  const f = fixture(), id = await open(f)
  for (const [actor, amount] of [[developer, 14000], [other, 17000]]) await f.saveProposal(actor, id, { amount, durationDays: 5, approach: "Подготовлю решение и воспроизводимую проверку результата.", revision: 0 })
  assert.equal((await f.readProposals(id, customer)).proposals.length, 2)
  const own = await f.readProposals(id, developer)
  assert.equal(own.proposals.length, 1)
  assert.equal(own.proposals[0].developerId, developer.id)
  assert.equal(own.history.length, 1)
  assert.doesNotMatch(JSON.stringify(own), /private\.example|passwordHash|17000/)
  assert.equal((await f.readProposals(id, moderator)).proposals.length, 2)
})

test("parallel selection chooses one executor and preserves the accepted proposal snapshot", async () => {
  const f = fixture(), id = await open(f)
  for (const actor of [developer, other]) await f.saveProposal(actor, id, { amount: 19000, durationDays: 5, approach: "Подготовлю решение с критериями проверки и инструкцией.", revision: 0 })
  const results = await Promise.allSettled(f.state().jobProposal.map(proposal => f.runJobCommand(customer, id, { action: "SELECT", proposalId: proposal.id, proposalRevision: proposal.revision })))
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1)
  assert.equal(f.state().jobContract.length, 1)
  assert.equal(f.state().jobProposal.filter(proposal => proposal.status === "SELECTED").length, 1)
  assert.equal(f.job().status, "EXECUTOR_SELECTED")
  await assert.rejects(() => f.saveProposal(developer, id, { amount: 1, durationDays: 1, approach: "Другое предложение после фиксации условий работы.", revision: 1 }), /закрыт/)
})

test("an edited or withdrawn proposal cannot be accepted using stale visible terms", async () => {
  const f = fixture(), id = await open(f)
  await f.saveProposal(developer, id, { amount: 10000, durationDays: 3, approach: "Решение по исходным условиям и проверка результата.", revision: 0 })
  const proposalId = f.proposal().id
  await f.saveProposal(developer, id, { amount: 20000, durationDays: 4, approach: "Обновлённые условия и дополнительная проверка результата.", revision: 1 })
  await assert.rejects(() => f.runJobCommand(customer, id, { action: "SELECT", proposalId, proposalRevision: 1 }), /изменился/)
  await f.runJobCommand(developer, id, { action: "WITHDRAW", revision: 2 })
  assert.equal(f.state().jobStatusLog.filter(event => event.proposalId === proposalId).length, 3)
  await assert.rejects(() => f.runJobCommand(customer, id, { action: "SELECT", proposalId, proposalRevision: 3 }), /изменился/)
})

test("public job projections exclude private controls and never read legacy requests", async () => {
  const f = fixture(), id = await open(f)
  const view = await f.readJob(id, null)
  assert.equal(view.canManage, false)
  assert.doesNotMatch(JSON.stringify(view), /moderationReason|submissionHash|revision|password|private\.example|cancellationReason/)
  await f.runJobCommand(moderator, id, { action: "SUSPEND", revision: f.job().revision, reason: "Закрытая информация для повторной проверки" })
  await assert.rejects(() => f.readJob(id, other), /не найден/)
  assert.equal((await f.readJob(id, customer)).canManage, true)
  await f.runJobCommand(moderator, id, { action: "RESTORE", revision: f.job().revision, reason: "Проверка завершена, публикация разрешена" })
  assert.equal((await f.readJob(id, null)).job.id, id)
})

test("private workspace and proposal audit records are not exposed to outsiders or the other executor", async () => {
  const f = fixture(), id = await selected(f)
  await assert.rejects(() => f.readWorkspace(id, other), /не найдена/)
  const workspace = await f.readWorkspace(id, developer)
  assert.equal(workspace.contract.amount, 18550)
  assert.equal(workspace.events.some(event => event.action.startsWith("PROPOSAL")), false)
  assert.doesNotMatch(JSON.stringify(workspace), /passwordHash|private\.example|submissionHash|s3Key/)
})

test("only the selected executor can start/deliver, and only the customer can accept", async () => {
  const f = fixture(), id = await selected(f)
  await assert.rejects(() => f.runJobCommand(customer, id, { action: "START" }), /исполнитель/)
  await assert.rejects(() => f.runJobCommand(other, id, { action: "START" }), /доступа/)
  await f.runJobCommand(developer, id, { action: "START" })
  const deliveryId = randomUUID()
  await f.runJobCommand(developer, id, { action: "DELIVER", id: deliveryId, text: "Готовый результат и инструкция с воспроизводимой проверкой.", attachmentIds: [] })
  await assert.rejects(() => f.runJobCommand(developer, id, { action: "ACCEPT", deliveryId }), /доступа/)
  await assert.rejects(() => f.runJobCommand(moderator, id, { action: "ACCEPT", deliveryId }), /доступа/)
  assert.equal(f.job().status, "ACCEPTANCE")
})

test("parallel acceptance and revision cannot record conflicting decisions", async () => {
  const f = fixture(), id = await selected(f); await f.runJobCommand(developer, id, { action: "START" })
  const deliveryId = randomUUID(); await f.runJobCommand(developer, id, { action: "DELIVER", id: deliveryId, text: "Готовый результат и инструкция с воспроизводимой проверкой.", attachmentIds: [] })
  const results = await Promise.allSettled([f.runJobCommand(customer, id, { action: "ACCEPT", deliveryId }), f.runJobCommand(customer, id, { action: "REVISION", deliveryId, reason: "Уточните обработку отсутствующих значений" })])
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1)
  assert.equal(f.state().jobStatusLog.filter(event => ["ACCEPT", "REVISION"].includes(event.action)).length, 1)
})

test("work cancellation requires the other participant and can be declined", async () => {
  const f = fixture(), id = await selected(f)
  await f.runJobCommand(customer, id, { action: "CANCEL", reason: "Изменились потребности в разработке" })
  await assert.rejects(() => f.runJobCommand(customer, id, { action: "CONFIRM_CANCEL" }), /другой стороне/)
  await assert.rejects(() => f.runJobCommand(developer, id, { action: "START" }), /нельзя/)
  await f.runJobCommand(developer, id, { action: "DECLINE_CANCEL" })
  await f.runJobCommand(developer, id, { action: "START" })
  await f.runJobCommand(developer, id, { action: "CANCEL", reason: "Предлагаю завершить заказ согласованной отменой" })
  await f.runJobCommand(customer, id, { action: "CONFIRM_CANCEL" })
  assert.equal(f.job().status, "CANCELLED")
})

test("disputes open one support case, pause acceptance and require staff resolution", async () => {
  const f = fixture(), id = await selected(f)
  await Promise.all([developer, customer].map(actor => f.runJobCommand(actor, id, { action: "DISPUTE", reason: "Нужно уточнить согласованные условия выполнения" })))
  assert.equal(f.state().jobDispute.length, 1)
  assert.equal(f.state().supportTicket.length, 1)
  assert.equal(f.job().status, "DISPUTED")
  await assert.rejects(() => f.runJobCommand(customer, id, { action: "RESUME", reason: "Самостоятельно завершаю рассмотрение спора" }), /модератора/)
  await f.runJobCommand(moderator, id, { action: "RESUME", reason: "Стороны уточнили условия, работа возобновляется" })
  assert.equal(f.job().status, "EXECUTOR_SELECTED")
  assert.equal(f.state().supportTicket[0].status, "RESOLVED")
  await f.runJobCommand(developer, id, { action: "DISPUTE", reason: "Возник повторный вопрос по условиям задачи" })
  assert.equal(f.state().supportTicket.length, 1)
  await f.runJobCommand(moderator, id, { action: "RESOLVE_CANCEL", reason: "Стороны подтвердили согласованную отмену заказа" })
  assert.equal(f.job().status, "CANCELLED")
})

test("reviews require completed participation and repeated submissions do not add reputation", async () => {
  const f = fixture(), id = await selected(f)
  await assert.rejects(() => f.runJobCommand(customer, id, { action: "REVIEW", rating: 5, text: "Отзыв до приёмки не разрешается" }), /после приёмки/)
  await f.runJobCommand(developer, id, { action: "START" })
  const deliveryId = randomUUID(); await f.runJobCommand(developer, id, { action: "DELIVER", id: deliveryId, text: "Готовый результат и инструкция с воспроизводимой проверкой.", attachmentIds: [] }); await f.runJobCommand(customer, id, { action: "ACCEPT", deliveryId })
  await assert.rejects(() => f.runJobCommand(other, id, { action: "REVIEW", rating: 5, text: "Чужой отзыв не должен быть опубликован" }), /доступа/)
  await Promise.all(Array.from({ length: 5 }, () => f.runJobCommand(customer, id, { action: "REVIEW", rating: 5, text: "Работа выполнена по согласованным условиям задачи." })))
  assert.equal(f.state().jobReview.length, 1)
  assert.equal(f.state().jobReview[0].recipientId, developer.id)
  assert.equal(f.state().review.length, 0, "product reputation stays separate")
})

test("a failed final audit write rolls back order state and notifications together", async () => {
  const f = fixture(), id = await selected(f)
  f.control.rejectWrite = (name, data) => { if (name === "jobStatusLog" && data.action === "START") throw new Error("audit unavailable") }
  await assert.rejects(() => f.runJobCommand(developer, id, { action: "START" }), /audit unavailable/)
  assert.equal(f.job().status, "EXECUTOR_SELECTED")
  assert.equal(f.state().jobStatusLog.filter(event => event.action === "START").length, 0)
})

test("message cursors include messages with the same timestamp without exposing another job", async () => {
  const f = fixture(), id = await selected(f), time = new Date()
  for (let i = 0; i < 110; i++) f.seed("jobMessage", { id: `message-${String(i).padStart(3, "0")}`, jobId: id, senderId: customer.id, text: "Private message", createdAt: time })
  const first = await f.readWorkspace(id, customer)
  assert.equal(first.messages.length, 100); assert.equal(first.hasOlderMessages, true)
  const older = await f.readWorkspace(id, customer, first.messages[0].id)
  assert.equal(older.messages.length, 10)
  assert.equal(new Set([...older.messages, ...first.messages].map(message => message.id)).size, 110)
  f.seed("jobMessage", { id: "foreign-message", jobId: "foreign-job", senderId: customer.id, text: "secret" })
  await assert.rejects(() => f.readWorkspace(id, customer, "foreign-message"), /не найдено/)
})

test("current bans prevent stale actors from changing orders and hide the customer's public job", async () => {
  const f = fixture(), id = await selected(f)
  f.state().user.find(user => user.id === developer.id).isBanned = true
  await assert.rejects(() => f.runJobCommand(developer, id, { action: "START" }), error => error.status === 403)
  f.state().user.find(user => user.id === customer.id).isBanned = true
  await assert.rejects(() => f.readJob(id, null), error => error.status === 404)
  assert.equal(f.job().status, "EXECUTOR_SELECTED")
})

test("delivery retries stay idempotent and cannot attach another participant's private files", async () => {
  const f = fixture(), id = await selected(f); await f.runJobCommand(developer, id, { action: "START" })
  const fileId = randomUUID()
  f.seed("jobAttachment", { id: fileId, jobId: id, authorId: customer.id })
  await assert.rejects(() => f.runJobCommand(developer, id, { action: "DELIVER", id: randomUUID(), text: "Результат с неподходящим файлом из другой стороны заказа.", attachmentIds: [fileId] }), /свои файлы/)
  const delivery = { action: "DELIVER", id: randomUUID(), text: "Готовый результат и инструкция с воспроизводимой проверкой.", attachmentIds: [] }
  await Promise.all(Array.from({ length: 5 }, () => f.runJobCommand(developer, id, delivery)))
  assert.equal(f.state().jobDelivery.length, 1)
  assert.equal(f.state().jobStatusLog.filter(event => event.action === "DELIVER").length, 1)
})
