import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

const products = [
  {
    title: "Telegram-бот записи клиентов",
    slug: "telegram-bot-zapis-klientov",
    shortDesc: "Автоматизирует запись клиентов через Telegram. Поддержка расписания, напоминаний и оплаты.",
    fullDesc: "Готовый Telegram-бот для автоматизации записи клиентов. Подходит для салонов красоты, медицинских центров, фитнес-студий.",
    category: "TELEGRAM" as const,
    price: 490000,
    features: ["Онлайн-запись 24/7", "Встроенная оплата ЮKassa", "Авто-напоминания", "Панель администратора"],
    targetAudience: "Салоны красоты, медицинские центры",
    techStack: ["Python", "aiogram", "PostgreSQL"],
    license: "personal",
    telegramBotUsername: "demo_booking_bot",
    rating: 4.8,
    reviewCount: 24,
    salesCount: 87,
    status: "APPROVED" as const,
  },
  {
    title: "Парсер Авито — недвижимость",
    slug: "parser-avito-nedvizhimost",
    shortDesc: "Собирает объявления с Авито по заданным фильтрам. Выгрузка в Excel, обновление по расписанию.",
    fullDesc: "Парсер для сбора объявлений о недвижимости с Авито. Фильтры по цене, районам, площади. Выгрузка в Excel.",
    category: "PARSER" as const,
    price: 290000,
    features: ["Гибкие фильтры", "Выгрузка в Excel", "Обновление по расписанию", "Уведомления о новых объявлениях"],
    targetAudience: "Риелторы, инвесторы в недвижимость",
    techStack: ["Python", "BeautifulSoup", "openpyxl"],
    license: "personal",
    rating: 4.5,
    reviewCount: 11,
    salesCount: 43,
    status: "APPROVED" as const,
  },
  {
    title: "Excel: учёт склада",
    slug: "excel-uchet-sklada",
    shortDesc: "Полноценная система учёта товаров на складе в Excel. Приход, расход, остатки, отчёты.",
    fullDesc: "Файл Excel с макросами VBA для ведения складского учёта. Не требует 1С или специального ПО.",
    category: "EXCEL" as const,
    price: 190000,
    features: ["Учёт прихода и расхода", "Остатки в реальном времени", "Автоматические отчёты", "Защита от случайного изменения"],
    targetAudience: "Малый и средний бизнес",
    techStack: ["VBA"],
    license: "personal",
    rating: 4.9,
    reviewCount: 36,
    salesCount: 152,
    status: "APPROVED" as const,
  },
  {
    title: "Автоматизация 1С: обработка заявок",
    slug: "avtomatizatsiya-1c-zayavki",
    shortDesc: "Внешняя обработка для 1С 8. Автоматически создаёт заказы из входящих заявок по email.",
    fullDesc: "Внешняя обработка для 1С: Предприятие 8.3. Подключается к IMAP-серверу, разбирает входящие заявки и создаёт заказы.",
    category: "AUTOMATION" as const,
    price: 790000,
    features: ["Интеграция с email (IMAP)", "Автосоздание заказов", "Логирование операций", "Настраиваемые шаблоны разбора"],
    targetAudience: "Компании на 1С: Предприятие 8",
    techStack: ["1С"],
    license: "personal",
    rating: 4.7,
    reviewCount: 8,
    salesCount: 19,
    status: "APPROVED" as const,
  },
  {
    title: "Telegram-магазин с оплатой",
    slug: "telegram-bot-magazin",
    shortDesc: "Готовый интернет-магазин в Telegram с каталогом, корзиной и оплатой через ЮKassa.",
    fullDesc: "Полноценный магазин в Telegram: каталог с фото, корзина, оформление заказа, оплата.",
    category: "TELEGRAM" as const,
    price: 890000,
    features: ["Каталог с фотографиями", "Корзина и оформление заказа", "Оплата через ЮKassa", "Админ-панель через Telegram"],
    targetAudience: "Интернет-магазины, малый бизнес",
    techStack: ["Python", "aiogram", "SQLite"],
    license: "personal",
    rating: 4.6,
    reviewCount: 17,
    salesCount: 34,
    status: "APPROVED" as const,
  },
  {
    title: "Мониторинг цен Wildberries",
    slug: "parser-wildberries-tseny",
    shortDesc: "Отслеживает изменения цен конкурентов на Wildberries. Уведомления в Telegram при снижении.",
    fullDesc: "Парсер для мониторинга цен на Wildberries. Задаёте список артикулов конкурентов — бот отслеживает и сообщает об изменениях.",
    category: "PARSER" as const,
    price: 350000,
    features: ["Мониторинг до 500 артикулов", "Уведомления в Telegram", "История цен в Excel", "Настраиваемый интервал проверки"],
    targetAudience: "Продавцы на Wildberries",
    techStack: ["Python", "Telegram API"],
    license: "personal",
    rating: 4.4,
    reviewCount: 9,
    salesCount: 28,
    status: "APPROVED" as const,
  },
]

async function main() {
  console.log("Seeding database...")

  const author = await db.user.upsert({
    where: { email: "demo@polka.ru" },
    update: {},
    create: {
      email: "demo@polka.ru",
      name: "Демо-разработчик",
      role: "DEVELOPER",
      agreedToTerms: true,
    },
  })

  for (const data of products) {
    await db.product.upsert({
      where: { slug: data.slug },
      update: {},
      create: {
        ...data,
        screenshots: [],
        authorId: author.id,
        publishedAt: new Date(),
      },
    })
  }

  console.log(`Seeded ${products.length} products.`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
