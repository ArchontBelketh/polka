# ПОЛКА — Технический роадмап
> Маркетплейс готовых программных продуктов для российского рынка

---

## Стек

| Слой | Технология |
|------|-----------|
| Framework | Next.js 14 (App Router) + TypeScript |
| База данных | PostgreSQL 15 + Prisma ORM |
| Аутентификация | NextAuth.js v5 (Telegram OAuth + email) |
| Хранилище файлов | Yandex Object Storage (S3-совместимый) |
| Платежи | ЮKassa SDK |
| Стили | Tailwind CSS + shadcn/ui |
| Сканер кода | bandit (Python), semgrep, v8unpack (1С .epf) |
| Деплой | Hetzner CX21 (~€4/мес) + Docker Compose |

---

## Структура проекта

```
polka/
├── .env.local                          # Переменные среды (не коммитить)
├── .env.example                        # Шаблон переменных
├── Dockerfile
├── docker-compose.yml                  # postgres + app
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
│
├── prisma/
│   ├── schema.prisma                   # Полная схема БД
│   └── seed.ts                         # Тестовые данные
│
├── scripts/
│   ├── scan.sh                         # Ручной запуск сканера
│   └── deploy.sh                       # Деплой на Hetzner
│
└── src/
    ├── app/
    │   ├── layout.tsx                  # Root layout + nav
    │   ├── page.tsx                    # Редирект → /catalog
    │   ├── globals.css
    │   │
    │   ├── (auth)/
    │   │   ├── login/page.tsx
    │   │   └── register/page.tsx       # Регистрация разработчика
    │   │
    │   ├── catalog/
    │   │   └── page.tsx                # Список продуктов + фильтры
    │   │
    │   ├── product/
    │   │   └── [slug]/page.tsx         # Страница продукта
    │   │
    │   ├── submit/
    │   │   └── page.tsx                # 5-шаговая форма загрузки
    │   │
    │   ├── dashboard/                  # Кабинет разработчика
    │   │   ├── page.tsx                # Сводка (продажи, баланс)
    │   │   ├── products/page.tsx       # Мои продукты
    │   │   └── payouts/page.tsx        # Запрос вывода средств
    │   │
    │   ├── purchases/
    │   │   └── page.tsx                # История покупок (покупатель)
    │   │
    │   ├── admin/                      # Панель модерации
    │   │   ├── queue/page.tsx          # Очередь на проверку
    │   │   └── review/[id]/page.tsx    # Карточка проверки продукта
    │   │
    │   └── api/
    │       ├── auth/[...nextauth]/route.ts
    │       │
    │       ├── products/
    │       │   ├── route.ts            # GET /api/products (список), POST (создать)
    │       │   └── [id]/
    │       │       └── route.ts        # GET, PATCH, DELETE
    │       │
    │       ├── upload/
    │       │   └── route.ts            # POST → presigned S3 URL
    │       │
    │       ├── scan/
    │       │   └── route.ts            # POST /api/scan?productId=... → запустить сканер
    │       │
    │       ├── moderation/
    │       │   └── [id]/route.ts       # POST { action, comment } → approve/reject
    │       │
    │       ├── payment/
    │       │   ├── create/route.ts     # POST → создать платёж в ЮKassa
    │       │   └── webhook/route.ts    # POST ← ЮKassa webhook
    │       │
    │       ├── download/
    │       │   └── [purchaseId]/route.ts  # GET → подписанный S3 URL (разовый, 15 мин)
    │       │
    │       └── reviews/
    │           └── route.ts            # POST (создать), GET (список по productId)
    │
    ├── components/
    │   ├── ui/                         # shadcn/ui (Button, Input, Badge, ...)
    │   │
    │   ├── layout/
    │   │   ├── Navbar.tsx
    │   │   └── Footer.tsx
    │   │
    │   ├── catalog/
    │   │   ├── ProductGrid.tsx
    │   │   ├── ProductCard.tsx
    │   │   └── CategoryFilter.tsx
    │   │
    │   ├── product/
    │   │   ├── ProductHeader.tsx
    │   │   ├── FeatureList.tsx
    │   │   ├── BuyPanel.tsx
    │   │   ├── ReviewList.tsx
    │   │   └── ReviewForm.tsx
    │   │
    │   ├── submit/
    │   │   ├── StepIndicator.tsx
    │   │   └── steps/
    │   │       ├── CategoryStep.tsx
    │   │       ├── DescriptionStep.tsx
    │   │       ├── FeaturesStep.tsx
    │   │       ├── MediaStep.tsx
    │   │       └── PricingStep.tsx
    │   │
    │   └── moderation/
    │       ├── QueueTable.tsx
    │       └── ScanResultsBadge.tsx
    │
    ├── lib/
    │   ├── db.ts                       # Prisma client (singleton)
    │   ├── auth.ts                     # NextAuth config
    │   ├── s3.ts                       # Yandex Object Storage (S3 SDK)
    │   ├── yookassa.ts                 # ЮKassa SDK wrapper
    │   ├── escrow.ts                   # Логика 7-дневного удержания
    │   ├── notify.ts                   # Telegram-уведомления разработчикам
    │   ├── slugify.ts                  # Генерация slug из названия
    │   └── scanner/
    │       ├── index.ts                # Оркестратор: запускает все инструменты
    │       ├── python.ts               # bandit runner (Python files)
    │       ├── semgrep.ts              # semgrep runner (все языки)
    │       ├── epf.ts                  # v8unpack → BSL grep (1С .epf/.erf)
    │       ├── excel.ts                # olevba → VBA extract (.xlsm)
    │       └── patterns.ts             # Словарь опасных паттернов по языку
    │
    └── types/
        └── index.ts                    # Product, User, Purchase, ScanResult, ...
```

---

## Схема базы данных (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role         { BUYER DEVELOPER MODERATOR ADMIN }
enum Category     { TELEGRAM PARSER EXCEL AUTOMATION WEB }
enum ProductStatus { DRAFT PENDING SCAN_FAILED APPROVED REJECTED SUSPENDED }
enum ScanStatus   { PENDING CLEAN WARNING BLOCKED }
enum PurchaseStatus { PENDING PAID DELIVERED REFUNDED DISPUTED }
enum PayoutStatus  { PENDING PROCESSING PAID }
enum FileType     { SOURCE BINARY DECOMPILED }

model User {
  id              String    @id @default(cuid())
  email           String?   @unique
  emailVerified   DateTime?
  name            String?
  telegramId      String?   @unique
  telegramHandle  String?
  phone           String?
  role            Role      @default(BUYER)
  inn             String?
  agreedToTerms   Boolean   @default(false)
  agreedAt        DateTime?
  balance         Int       @default(0)   // в копейках
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  products        Product[]
  purchases       Purchase[]
  reviews         Review[]
  payouts         Payout[]
  accounts        Account[]
  sessions        Session[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  access_token      String? @db.Text
  refresh_token     String? @db.Text
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Product {
  id             String        @id @default(cuid())
  title          String
  slug           String        @unique
  shortDesc      String
  fullDesc       String        @db.Text
  category       Category
  price          Int           // в копейках
  status         ProductStatus @default(DRAFT)
  authorId       String
  features       String[]
  screenshots    String[]      // S3 keys
  demoUrl        String?
  videoUrl       String?
  targetAudience String?
  techStack      String?
  license        String        @default("personal")
  telegramBotUsername String?
  rating         Float         @default(0)
  reviewCount    Int           @default(0)
  salesCount     Int           @default(0)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  publishedAt    DateTime?
  author         User          @relation(fields: [authorId], references: [id])
  files          ProductFile[]
  purchases      Purchase[]
  reviews        Review[]
  scanResult     ScanResult?
  moderationLogs ModerationLog[]

  @@index([status])
  @@index([category])
  @@index([authorId])
}

model ProductFile {
  id          String    @id @default(cuid())
  productId   String
  s3Key       String
  fileName    String
  fileSize    Int
  fileType    FileType
  format      String    // .py | .epf | .xlsm | .js | ...
  createdAt   DateTime  @default(now())
  product     Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
}

model ScanResult {
  id          String     @id @default(cuid())
  productId   String     @unique
  status      ScanStatus @default(PENDING)
  findings    Json       @default("[]")
  scannedAt   DateTime?
  toolsRun    String[]
  product     Product    @relation(fields: [productId], references: [id], onDelete: Cascade)
}

model ModerationLog {
  id          String   @id @default(cuid())
  productId   String
  moderatorId String?
  action      String   // APPROVED | REJECTED | CHANGES_REQUESTED | SUSPENDED
  comment     String?
  createdAt   DateTime @default(now())
  product     Product  @relation(fields: [productId], references: [id])
}

model Purchase {
  id            String         @id @default(cuid())
  buyerId       String
  productId     String
  amount        Int            // в копейках
  status        PurchaseStatus @default(PENDING)
  paymentId     String?        // ID платежа в ЮKassa
  escrowUntil   DateTime?      // дата снятия удержания
  downloadCount Int            @default(0)
  createdAt     DateTime       @default(now())
  paidAt        DateTime?
  buyer         User           @relation(fields: [buyerId], references: [id])
  product       Product        @relation(fields: [productId], references: [id])

  @@index([buyerId])
  @@index([productId])
}

model Review {
  id          String   @id @default(cuid())
  productId   String
  authorId    String
  rating      Int      // 1-5
  text        String   @db.Text
  createdAt   DateTime @default(now())
  product     Product  @relation(fields: [productId], references: [id])
  author      User     @relation(fields: [authorId], references: [id])
  @@unique([productId, authorId])
}

model Payout {
  id          String   @id @default(cuid())
  developerId String
  amount      Int      // в копейках
  status      PayoutStatus @default(PENDING)
  requestedAt DateTime @default(now())
  paidAt      DateTime?
  developer   User     @relation(fields: [developerId], references: [id])
}
```

---

## Переменные среды (.env.local)

```env
# База данных
DATABASE_URL="postgresql://polka:password@localhost:5432/polka_db"

# NextAuth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# Telegram (для OAuth и уведомлений)
TELEGRAM_BOT_TOKEN="bot_token_from_botfather"
TELEGRAM_BOT_SECRET="random-webhook-secret"

# Yandex Object Storage (S3)
YANDEX_S3_ACCESS_KEY="..."
YANDEX_S3_SECRET_KEY="..."
YANDEX_S3_BUCKET="polka-files"
YANDEX_S3_ENDPOINT="https://storage.yandexcloud.net"
YANDEX_S3_REGION="ru-central1"

# ЮKassa
YOOKASSA_SHOP_ID="..."
YOOKASSA_SECRET_KEY="..."

# Приложение
NEXT_PUBLIC_APP_URL="http://localhost:3000"
COMMISSION_RATE="0.20"
ESCROW_DAYS="7"
```

---

## API маршруты

| Метод | URL | Описание | Доступ |
|-------|-----|----------|--------|
| GET | `/api/products` | Список с фильтрами и пагинацией | Все |
| POST | `/api/products` | Создать продукт (черновик) | Developer |
| GET | `/api/products/[id]` | Детали продукта | Все |
| PATCH | `/api/products/[id]` | Обновить черновик | Author |
| DELETE | `/api/products/[id]` | Удалить черновик | Author |
| POST | `/api/upload` | Получить presigned S3 URL | Developer |
| POST | `/api/scan?productId=X` | Запустить авто-сканер | Developer/Admin |
| POST | `/api/moderation/[id]` | Одобрить / отклонить | Moderator |
| POST | `/api/payment/create` | Создать платёж ЮKassa | Buyer |
| POST | `/api/payment/webhook` | Webhook от ЮKassa | System |
| GET | `/api/download/[purchaseId]` | Signed S3 URL (15 мин) | Buyer |
| GET | `/api/reviews?productId=X` | Отзывы по продукту | Все |
| POST | `/api/reviews` | Оставить отзыв | Buyer (after purchase) |

---

## Логика сканера (src/lib/scanner/)

### index.ts — оркестратор
```typescript
// Запускается через POST /api/scan
// 1. Скачивает архив из S3 во временную директорию
// 2. Определяет типы файлов внутри
// 3. Запускает нужные инструменты параллельно
// 4. Агрегирует результаты → ScanResult в БД
// 5. Обновляет product.status:
//    CLEAN   → остаётся PENDING (идёт на ручную проверку)
//    WARNING → PENDING + флаги видны модератору
//    BLOCKED → SCAN_FAILED (автоотклонение)

export async function runScan(productId: string): Promise<ScanResult>
```

### epf.ts — проверка 1С файлов
```typescript
// 1. v8unpack -U file.epf ./unpacked/
// 2. Рекурсивный grep по .bsl файлам
// 3. Паттерны опасных функций:
const CRITICAL = [
  /Shell\s*\(/i,           // Оболочка / Shell
  /RunApp\s*\(/i,          // ЗапуститьПриложение
  /CreateCOMObject\s*\(\s*['"]WScript/i,
  /Выполнить\s*\([^"']/,   // eval с переменной
]
const WARNING = [
  /HTTPConnection/i,        // Сетевые запросы — проверить URL
  /GetEnvVar\s*\(/i,       // Чтение env переменных
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, // hardcoded IP
]
```

### Инструменты на сервере (установить при деплое)
```bash
pip install bandit safety semgrep --break-system-packages
# v8unpack: собрать из исходников (github.com/e8tools/v8unpack)
# или использовать OneScript: oscript.io
pip install olevba  # для .xlsm
```

---

## Логика платежей (ЮKassa)

```
Покупатель нажимает "Купить"
    ↓
POST /api/payment/create
  → создаём Purchase (status: PENDING)
  → вызываем ЮKassa: создать платёж на сумму продукта
  → возвращаем confirmation_url
    ↓
Редирект на страницу оплаты ЮKassa
    ↓
POST /api/payment/webhook (от ЮKassa)
  → проверяем подпись
  → если payment.status === 'succeeded':
      Purchase.status = PAID
      Purchase.escrowUntil = now() + 7 days
      Purchase.paidAt = now()
      → генерируем signed S3 URL (15 мин)
      → отправляем email/Telegram покупателю
      → начисляем на баланс разработчика (удержание до escrowUntil)
    ↓
GET /api/download/[purchaseId]
  → проверяем что Purchase.status === PAID
  → генерируем presigned S3 URL (900 сек)
  → инкрементируем downloadCount
    ↓
Через 7 дней (cron job или при следующем входе разработчика)
  → Purchase.status = DELIVERED
  → разблокируем сумму на балансе разработчика
  → разработчик может запросить вывод
```

---

## Комиссия

```
Цена продукта:          ₽ 4 900   (100%)
Комиссия платформы 20%: ₽   980
Комиссия ЮKassa ~2.5%:  ₽   123
─────────────────────────────────
Выплата разработчику:   ₽ 3 797   (77.5%)
```

---

## Docker Compose (docker-compose.yml)

```yaml
version: '3.8'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: polka
      POSTGRES_PASSWORD: password
      POSTGRES_DB: polka_db
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  app:
    build: .
    ports:
      - "3000:3000"
    env_file: .env.local
    depends_on:
      - db

volumes:
  pgdata:
```

---

## Команды для запуска проекта

```bash
# 1. Инициализация
npx create-next-app@latest polka \
  --typescript --tailwind --eslint \
  --app --src-dir --import-alias "@/*"
cd polka

# 2. Зависимости
npm install @prisma/client prisma
npm install next-auth@beta
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install zod
npm install node-telegram-bot-api
npx prisma init

# 3. shadcn/ui
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input badge card table

# 4. База данных (локально через Docker)
docker compose up -d db
npx prisma migrate dev --name init
npx prisma generate
npx tsx prisma/seed.ts

# 5. Запуск
npm run dev
```

---

## Неделя 1 — Фундамент ✅

**Цель:** работающий каталог с тестовыми данными, аутентификация.

- [x] `npx create-next-app` + установка зависимостей
- [x] `prisma/schema.prisma` — полная схема БД
- [x] `docker-compose.yml` → `docker compose up -d db`
- [x] `npx prisma migrate dev --name init`
- [x] `src/lib/db.ts` — Prisma singleton
- [x] `src/lib/auth.ts` — NextAuth: email/password через Credentials
- [x] `src/app/layout.tsx` — тёмная тема, шрифт, Navbar
- [x] `src/components/layout/Navbar.tsx` — логотип, поиск, кнопки
- [x] `src/app/catalog/page.tsx` — grid продуктов (Server Component, моковые данные)
- [x] `src/components/catalog/ProductCard.tsx`
- [x] `src/components/catalog/CategoryFilter.tsx` — client component
- [x] `src/app/product/[slug]/page.tsx` — детальная страница (статика)
- [x] `prisma/seed.ts` — тестовые продукты (разные категории)

---

## Неделя 2 — Загрузка и модерация ✅

**Цель:** разработчик может загрузить продукт, запустится авто-скан, модератор может одобрить.

- [x] `src/app/submit/page.tsx` — 5-шаговая форма (CategoryStep → … → PricingStep)
- [x] `src/app/api/upload/route.ts` — presigned S3 URL для загрузки файлов
- [x] `src/lib/s3.ts` — S3 client для Yandex Object Storage
- [x] `src/app/api/products/route.ts` — POST создать черновик
- [x] `src/lib/scanner/index.ts` — оркестратор сканера
- [x] `src/lib/scanner/python.ts` — запуск `bandit` через `child_process`
- [x] `src/lib/scanner/semgrep.ts` — запуск `semgrep`
- [x] `src/lib/scanner/epf.ts` — `v8unpack` + BSL grep
- [x] `src/lib/scanner/patterns.ts` — словарь опасных паттернов
- [x] `src/app/api/scan/route.ts` — POST запустить сканер
- [x] `Dockerfile` — установить `bandit`, `semgrep`, `olevba`, `v8unpack` в образ
- [x] `src/proxy.ts` — auth guard для `/admin`, `/dashboard`
- [x] `src/app/admin/queue/page.tsx` — таблица ожидающих продуктов
- [x] `src/app/admin/review/[id]/page.tsx` — карточка проверки (код, findings, кнопки)
- [x] `src/app/api/moderation/[id]/route.ts` — approve/reject/changes_requested/suspended
- [x] `src/app/dashboard/products/page.tsx` — мои продукты + статус

---

## Неделя 3 — Платежи и доставка ✅

**Цель:** полный цикл покупки от клика "Купить" до скачивания файла.

- [x] `src/lib/yookassa.ts` — обёртка над ЮKassa REST API (`createPayment`, `getPayment`)
- [x] `src/app/api/payment/create/route.ts` — создаёт Purchase(PENDING) → ЮKassa → возвращает `confirmationUrl`
- [x] `src/app/api/payment/webhook/route.ts` — re-fetch для верификации + Purchase(PAID) + salesCount++
- [x] `src/lib/escrow.ts` — `escrowUntilDate`, `developerPayout`, `releaseExpiredEscrow`
- [x] `src/app/api/cron/escrow/route.ts` — разблокировка средств (защита через `x-cron-secret`)
- [x] `src/app/api/download/[purchaseId]/route.ts` — presigned URL (900 сек) + downloadCount++
- [x] `src/components/product/BuyPanel.tsx` — серверный: проверяет сессию и статус покупки
- [x] `src/components/product/BuyButton.tsx` — клиентский: fetch → редирект на страницу ЮKassa
- [x] `src/app/purchases/page.tsx` — история покупок с кнопкой «Скачать»
- [x] `src/app/dashboard/page.tsx` — баланс, эскроу, последние продажи
- [x] `src/app/dashboard/payouts/page.tsx` — запрос вывода средств + история
- [x] `src/app/api/payouts/route.ts` — GET список / POST запрос вывода
- [x] `src/app/catalog/page.tsx` — реальные данные из БД, пагинация

---

## Неделя 4 — Запуск ✅

**Цель:** первые живые клиенты и разработчики, продукт в продакшне.

- [x] `src/app/api/disputes/route.ts` — покупатель открывает спор, модератор разрешает (`REFUNDED` / `DELIVERED`)
- [x] `src/app/api/reviews/route.ts` — GET список + POST (только после PAID/DELIVERED покупки)
- [x] `src/components/product/ReviewList.tsx` — серверный компонент, список отзывов со звёздами
- [x] `src/components/product/ReviewForm.tsx` — клиентский, интерактивный выбор оценки
- [x] Пересчёт `Product.rating` и `reviewCount` атомарно через `$transaction` при каждом отзыве
- [x] `src/lib/notify.ts` — Telegram-уведомления: новая продажа, одобрение/отказ, открытие спора
- [x] Уведомления подключены в webhook (продажа) и модерацию (одобрение/отказ)
- [x] `Dockerfile` — multi-stage build: `deps → scanner-tools → builder → runner`
- [x] `next.config.ts` — `output: "standalone"` для Docker
- [x] `scripts/deploy.sh` — rsync + SSH: build, migrate, restart на Hetzner
- [x] SEO: `src/app/catalog/page.tsx` — OpenGraph + Twitter Card метаданные
- [x] `src/app/product/[slug]/page.tsx` — JSON-LD `SoftwareApplication` + `AggregateRating`, OG-теги
- [ ] SSL через Caddy или Nginx reverse proxy — **настроить на сервере**
- [ ] Проверить webhook ЮKassa на продакшн-URL — **после получения домена**
- [ ] Системный cron для эскроу — **добавить в crontab сервера**
- [ ] Onboard первых 5–10 продуктов вручную

---

## Неделя 5 — Рост (следующие шаги)

**Цель:** удержание пользователей, доверие к платформе, масштабирование.

- [ ] **Telegram Login Widget** — кастомный NextAuth Credentials-провайдер с проверкой init data hash
- [ ] **Email-уведомления** — дублировать Telegram-нотификации через Resend или nodemailer
- [ ] **Страница разработчика** — `/developer/[id]`: продукты, рейтинг, статистика продаж
- [ ] **Слайдер скриншотов** — несколько изображений на странице продукта
- [ ] **Промокоды** — модель `Coupon`, поле `couponCode` в форме оплаты
- [ ] **Версионирование продуктов** — загрузка обновления + уведомление покупателям
- [ ] **Rate limiting** — `@upstash/ratelimit` на `/api/upload`, `/api/reviews`, `/api/payment/create`
- [ ] **E2E-тесты** — Playwright: регистрация → загрузка → покупка → скачивание
- [ ] **Мониторинг ошибок** — Sentry в продакшне
- [ ] **Индекс на `Purchase.escrowUntil`** — для эффективной работы cron-запроса
- [ ] **Избранное** — модель `Wishlist`, кнопка на карточке продукта
- [ ] **og-default.png** — добавить заглушку в `public/` для OG-тегов каталога

---

## Ключевые решения для помни

1. **Slug** генерируется из названия + cuid suffix: `bot-dlya-zapisi-klientov-abc123`
2. **Файлы** в S3 хранятся по пути: `products/{productId}/source/{filename}`
3. **Скриншоты** хранятся: `products/{productId}/screenshots/{index}.jpg`
4. **Download URL** одноразовый: expires 900 сек, инкрементируем `downloadCount`
5. **Webhook ЮKassa** — обязательно проверять `X-Idempotence-Key` и IP-адрес
6. **Сканер** запускается асинхронно — результат пишем в `ScanResult` и уведомляем модератора
7. **Категория TELEGRAM** имеет доп. поле `telegramBotUsername` для проверки демо-бота
8. **Формат .epf** — требовать одновременно `.epf` + `.bsl` исходники, diff через v8unpack
9. **Escrow cron** — на Hetzner нет встроенного планировщика для Next.js; использовать `node-cron` внутри `/api/cron/escrow/route.ts` + системный cron (`crontab`) или GitHub Actions scheduled workflow для вызова эндпоинта
10. **Сканер в Docker** — `bandit`, `semgrep`, `olevba`, `v8unpack` должны быть в Dockerfile; сканер запускается через `child_process.exec` с таймаутом 60 сек на инструмент
