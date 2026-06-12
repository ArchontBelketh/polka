/**
 * Seeds (or cleans) a realistic scenario for end-to-end role testing.
 *
 *   npx tsx scripts/seed-e2e-scenario.ts          # seed
 *   npx tsx scripts/seed-e2e-scenario.ts --clean  # remove everything it created
 *
 * Everything it creates uses ids/slugs prefixed with "e2e" so cleanup is exact.
 * Payments and S3 aren't available in dev, so the PAID purchase, files and
 * messages are inserted directly to make every dashboard meaningful.
 */
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

const APPROVED_ID = "e2eapproved"
const APPROVED_SLUG = "e2e-approved-product"
const PENDING_ID = "e2epending"
const PENDING_SLUG = "e2e-pending-product"
const PURCHASE_ID = "e2epurchase"
const QUESTION_ID = "e2equestion"
const MSG1_ID = "e2emsg1"
const MSG2_ID = "e2emsg2"
const COUPON_CODE = "E2ETEST10"
const TICKET_ID = "e2eticket"
const FILE_ID = "e2efile"

async function clean() {
  const dev = await db.user.findUnique({ where: { email: "dev@polka.test" } })
  if (dev) await db.developerPlan.updateMany({ where: { userId: dev.id }, data: { totalSlots: 2 } })
  await db.purchaseMessage.deleteMany({ where: { id: { in: [MSG1_ID, MSG2_ID] } } })
  await db.productQuestion.deleteMany({ where: { id: QUESTION_ID } })
  await db.purchase.deleteMany({ where: { id: PURCHASE_ID } })
  await db.ticketMessage.deleteMany({ where: { ticketId: TICKET_ID } })
  await db.supportTicket.deleteMany({ where: { id: TICKET_ID } })
  await db.coupon.deleteMany({ where: { code: COUPON_CODE } })
  // Review and ModerationLog reference Product without cascade — delete first
  await db.review.deleteMany({ where: { productId: { in: [APPROVED_ID, PENDING_ID] } } })
  await db.scanResult.deleteMany({ where: { productId: { in: [APPROVED_ID, PENDING_ID] } } })
  await db.moderationLog.deleteMany({ where: { productId: { in: [APPROVED_ID, PENDING_ID] } } })
  await db.productFile.deleteMany({ where: { productId: { in: [APPROVED_ID, PENDING_ID] } } })
  await db.product.deleteMany({ where: { id: { in: [APPROVED_ID, PENDING_ID] } } })
  console.log("E2E scenario cleaned.")
}

async function seed() {
  const [dev, buyer, admin] = await Promise.all([
    db.user.findUnique({ where: { email: "dev@polka.test" } }),
    db.user.findUnique({ where: { email: "buyer@polka.test" } }),
    db.user.findUnique({ where: { email: "admin@polka.test" } }),
  ])
  if (!dev || !buyer || !admin) {
    throw new Error("Test accounts missing — run: npx tsx scripts/seed-test-users.ts")
  }

  // Give the developer free slots so the /submit wizard is reachable
  // (the seeded products would otherwise fill the default Free plan).
  await db.developerPlan.upsert({
    where: { userId: dev.id },
    update: { totalSlots: 10 },
    create: { userId: dev.id, plan: "FREE", totalSlots: 10 },
  })

  const installGuide = `## Установка\n\n1. Распакуйте архив в любую папку\n2. Установите зависимости: \`pip install -r requirements.txt\`\n3. Скопируйте \`config.example.ini\` в \`config.ini\` и впишите токен\n4. Запустите: \`python main.py\`\n\n## Проверка\nОткройте http://localhost:8000 — должна открыться панель.`

  // ── Approved product owned by the developer ──────────────────────────────
  await db.product.upsert({
    where: { id: APPROVED_ID },
    update: {},
    create: {
      id: APPROVED_ID,
      title: "E2E Бот учёта заявок",
      slug: APPROVED_SLUG,
      shortDesc: "Демо-продукт для e2e-тестов: Telegram-бот, который принимает и учитывает заявки клиентов.",
      fullDesc: "Полнофункциональный демонстрационный продукт, используемый автотестами ПОЛКИ. Принимает заявки, ведёт учёт, шлёт напоминания.",
      category: "TELEGRAM",
      price: 350000,
      status: "APPROVED",
      authorId: dev.id,
      features: ["Приём заявок 24/7", "Учёт в Excel", "Напоминания", "Панель администратора"],
      screenshots: [],
      techStack: ["Python", "aiogram"],
      installGuide,
      requirements: ["Python 3.10+", "Windows 10/11", "Токен Telegram-бота"],
      rating: 4.7,
      reviewCount: 0,
      salesCount: 12,
      publishedAt: new Date(),
    },
  })

  await db.productFile.upsert({
    where: { id: FILE_ID },
    update: {},
    create: {
      id: FILE_ID,
      productId: APPROVED_ID,
      s3Key: "local/e2e-bot.zip",
      fileName: "e2e-bot.zip",
      fileSize: 1_240_000,
      fileType: "SOURCE",
      format: "zip",
      sha256: "e2e0000000000000000000000000000000000000000000000000000000000000",
    },
  })

  // ── Pending product (for the moderation queue) ───────────────────────────
  await db.product.upsert({
    where: { id: PENDING_ID },
    update: { status: "PENDING", manuallyVerified: false, verifiedAt: null },
    create: {
      id: PENDING_ID,
      title: "E2E Парсер маркетплейсов",
      slug: PENDING_SLUG,
      shortDesc: "Демо-продукт на модерации: парсер цен с маркетплейсов с выгрузкой в Excel.",
      fullDesc: "Демонстрационный продукт в очереди модерации для e2e-тестов. Парсит цены, выгружает в Excel, шлёт уведомления.",
      category: "PARSER",
      price: 290000,
      status: "PENDING",
      authorId: dev.id,
      features: ["Парсинг по фильтрам", "Выгрузка в Excel", "Уведомления в Telegram"],
      screenshots: [],
      techStack: ["Python", "BeautifulSoup"],
      installGuide,
      requirements: ["Python 3.11+", "Доступ в интернет"],
      riskScore: 35,
      autoDecision: "QUEUE_LOW",
      publishedAt: null,
    },
  })

  await db.scanResult.upsert({
    where: { productId: PENDING_ID },
    update: {},
    create: {
      productId: PENDING_ID,
      status: "WARNING",
      scannedAt: new Date(),
      toolsRun: ["bandit", "semgrep", "duplicate-check"],
      findings: [
        {
          tool: "network-extra",
          severity: "warning",
          message: "Обнаружен обращение к внешнему API без HTTPS",
          file: "parser/client.py",
          line: 42,
        },
        {
          tool: "duplicate-check",
          severity: "warning",
          message: "Возможный дубликат: файл совпадает с продуктом «E2E Бот учёта заявок» другого автора",
          file: "parser.zip",
          link: `/admin/review/${APPROVED_ID}`,
        },
      ],
    },
  })

  await db.moderationLog.create({
    data: {
      productId: PENDING_ID,
      action: "QUEUED",
      comment: "score=35, decision=QUEUE_LOW. base_script(+5), scan_warnings(+15), duplicate_file(+30), developer_trusted(-10)",
    },
  })

  // ── PAID purchase by the buyer (enables download / review / messages) ─────
  await db.purchase.upsert({
    where: { id: PURCHASE_ID },
    update: { status: "PAID" },
    create: {
      id: PURCHASE_ID,
      buyerId: buyer.id,
      productId: APPROVED_ID,
      amount: 350000,
      status: "PAID",
      escrowUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      paidAt: new Date(),
      lastMessageAt: new Date(),
    },
  })

  // ── A seeded conversation in the purchase thread ─────────────────────────
  await db.purchaseMessage.upsert({
    where: { id: MSG1_ID },
    update: {},
    create: {
      id: MSG1_ID,
      purchaseId: PURCHASE_ID,
      senderId: buyer.id,
      text: "Здравствуйте! Подскажите, нужен ли отдельный сервер или можно запускать на своём ПК?",
      isRead: true,
      createdAt: new Date(Date.now() - 60_000),
    },
  })
  await db.purchaseMessage.upsert({
    where: { id: MSG2_ID },
    update: {},
    create: {
      id: MSG2_ID,
      purchaseId: PURCHASE_ID,
      senderId: dev.id,
      text: "Добрый день! Можно на обычном ПК с Windows — главное, чтобы был установлен Python 3.10+.",
      isRead: false,
      createdAt: new Date(Date.now() - 30_000),
    },
  })

  // ── An unanswered question on the product page ───────────────────────────
  await db.productQuestion.upsert({
    where: { id: QUESTION_ID },
    update: {},
    create: {
      id: QUESTION_ID,
      productId: APPROVED_ID,
      authorId: buyer.id,
      question: "Поддерживается ли выгрузка в Google Sheets, или только Excel?",
    },
  })

  // ── A coupon (for the admin) ─────────────────────────────────────────────
  await db.coupon.upsert({
    where: { code: COUPON_CODE },
    update: {},
    create: { code: COUPON_CODE, discountPct: 10, maxUses: 100, createdBy: admin.id },
  })

  // ── A support ticket (for moderator/admin support page) ──────────────────
  await db.supportTicket.upsert({
    where: { id: TICKET_ID },
    update: {},
    create: {
      id: TICKET_ID,
      authorId: buyer.id,
      subject: "E2E: вопрос по возврату средств",
      category: "PURCHASE",
      productId: APPROVED_ID,
      status: "OPEN",
      messages: {
        create: { authorId: buyer.id, text: "Не разобрался с настройкой, как оформить возврат?" },
      },
    },
  })

  console.log("E2E scenario seeded:")
  console.log(`  approved product: /product/${APPROVED_SLUG} (id ${APPROVED_ID}, owner dev)`)
  console.log(`  pending product:  id ${PENDING_ID} (in moderation queue)`)
  console.log(`  paid purchase:    id ${PURCHASE_ID} (buyer → approved product)`)
  console.log(`  question, 2 messages, coupon ${COUPON_CODE}, support ticket`)
}

async function main() {
  if (process.argv.includes("--clean")) await clean()
  else await seed()
  await db.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await db.$disconnect()
  process.exit(1)
})
