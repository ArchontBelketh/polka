# CYBERПОЛКА — Технический роадмап
> Маркетплейс готовых программных продуктов для российского рынка

> **Бренд:** проект переименован «ПОЛКА» → **CYBERПОЛКА** (прод `cyberpolka.store`).
> Ниже по тексту в исторических записях по неделям местами встречается прежнее имя.
> **Схема БД управляется через `prisma db push`** — каталога миграций в проекте нет,
> команды `prisma migrate` в старых разделах ниже заменены на `db push`.

---

## Стек

| Слой | Технология |
|------|-----------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| База данных | PostgreSQL + Prisma 7 (`@prisma/adapter-pg`, клиент в `src/generated/prisma`) |
| Аутентификация | NextAuth v5 (JWT): Telegram Login + credentials (email) |
| Хранилище файлов | Yandex Object Storage (S3-совместимый) |
| Платежи | ЮKassa (REST API) |
| Стили | Tailwind CSS v4 (`@theme inline`) + Radix-примитивы |
| Сканер кода | bandit (Python), semgrep, oletools (`olevba`), BSL-паттерны (1С .epf) |
| AI-ревью / автомодерация | Gemini / Ollama / YandexGPT (провайдер через env) |
| Деплой | Ubuntu VPS + Docker Compose + nginx + Let's Encrypt |

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

> **Единственный источник правды — [`prisma/schema.prisma`](prisma/schema.prisma).**
> Раньше здесь дублировался полный дамп схемы; он устаревал быстрее кода, поэтому
> заменён на карту моделей ниже. Смотрите актуальные поля прямо в файле схемы.

**Enum'ы:** `Role` (BUYER/DEVELOPER/MODERATOR/ADMIN), `Category`, `ProductStatus`,
`ScanStatus`, `PurchaseStatus`, `PayoutStatus`, `TicketCategory`, `TicketStatus`,
`FileType`, `ProductVersionStatus`.

**Модели:**

| Модель | Назначение |
|--------|-----------|
| `User` | Пользователь; роль, баланс, telegram/email, `resetTokenHash`, `emailVerifyTokenHash`, бан |
| `Account`, `Session`, `VerificationToken` | NextAuth |
| `Product` | Продукт; `riskScore`, `autoDecision`, `aiReviewFlags`, `manuallyVerified`, `installGuide`, `requirements`, `techStack` |
| `ProductFile` | Файлы продукта; `sha256` (дедуп) |
| `ProductVersion` | Версии с отдельной модерацией (`autoApproved`, `riskScore`) |
| `ScanResult` | Результат сканера (`findings`, `toolsRun`) |
| `ModerationLog` | История модерации (в т.ч. авто-логи AUTO_APPROVED/REJECTED/QUEUED) |
| `Purchase` | Покупка; эскроу, `downloadCount`, `lastMessageAt` |
| `PurchaseMessage` | Приватный чат покупатель ↔ разработчик |
| `ProductQuestion` | Публичный Q&A до покупки |
| `Review` | Отзывы (уникально по продукту+автор) |
| `Payout` | Заявки на вывод (PENDING→PROCESSING→PAID/REJECTED) |
| `Wishlist`, `Coupon` | Избранное, промокоды |
| `SupportTicket`, `TicketMessage` | Поддержка |
| `DeveloperPlan`, `SlotPurchase` | Тариф (FREE/PRO, `totalSlots`), докупка слотов |
| `AiReview` | Заказанные AI-ревью (PENDING→PROCESSING→DONE/FAILED) |
| `CronHeartbeat` | Отметка успешных прогонов cron (эскроу, AI-ревью) |

> Денежные суммы — в копейках (`Int`). `usedSlots` не хранится: считается динамически
> через `db.product.count`. Поля `riskScore`/`trustScore` у пользователя не хранятся —
> тир разработчика вычисляется агрегатом по продуктам (см. AUTO_MODERATION.md).

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

### Инструменты на сервере (ставятся в Dockerfile, стадия runner)
```bash
apt-get install -y python3 python3-pip git
pip3 install --break-system-packages bandit semgrep oletools   # oletools даёт CLI olevba (.xlsm/.docm)
```
> Ставятся в том же `python3`, который их и запускает (иначе шебанг/site-packages
> из отдельной стадии не совпадают и сканеры не стартуют). `.epf` (1С) проверяются
> BSL-паттернами; отдельный `v8unpack` в образ не ставится.

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

> Ключ `version:` в compose устарел и не используется. В проде поверх базового
> файла накатывается `docker-compose.prod.yml` (изоляция порта БД, healthcheck,
> стойкий пароль).

```yaml
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
npm run db:push        # схема управляется db push, миграций нет
npm run db:generate
npm run db:seed:demo   # демо-данные (dev-only)

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

## Неделя 5 — Рост ✅ (частично)

**Цель:** удержание пользователей, доверие к платформе, масштабирование.

- [x] **Страница разработчика** — `/developer/[id]`: продукты, рейтинг, статистика продаж
- [x] **Избранное** — модель `Wishlist` в схеме, API `/api/wishlist` (toggle + list)
- [x] **Промокоды** — модель `Coupon` в схеме, API `/api/coupons/validate`, поле в форме оплаты
- [x] **Rate limiting** — библиотека `src/lib/ratelimit.ts` с пре-настроенными лимитами
- [x] **Бейджи стека технологий** — цветные `TechBadge` на карточках, странице продукта, дашборде, модерации
- [x] **TechStackPicker** — 44 предустановленных тега по группам + кастомные; заменяет ручной ввод в форме
- [ ] **Telegram Login Widget** — кастомный NextAuth Credentials-провайдер с проверкой init data hash
- [ ] **Email-уведомления** — дублировать Telegram-нотификации через Resend или nodemailer
- [ ] **Слайдер скриншотов** — карусель по массиву `screenshots` на странице продукта
- [ ] **Версионирование продуктов** — загрузка обновления + уведомление покупателям
- [ ] **E2E-тесты** — Playwright: регистрация → загрузка → покупка → скачивание
- [ ] **Мониторинг ошибок** — Sentry в продакшне
- [ ] **og-default.png** — добавить заглушку в `public/` для OG-тегов каталога

---

## Неделя 6 — Каталог и завершение начатого ✅

**Цель:** закрыть незавершённые задачи и улучшить обнаруживаемость продуктов.

### Быстрые задачи
- [x] **Кнопка «В избранное»** — `WishlistButton` в `ProductCard`; каталог передаёт `isWishlisted` из wishlist пользователя
- [x] **Rate limiting** — `limits.*` из `src/lib/ratelimit.ts` применён в `/api/upload`, `/api/payment/create`, `/api/reviews`, `/api/coupons/validate`
- [x] **Admin-панель промокодов** — `/admin/coupons`: список, создание, деактивация, удаление; API `/api/coupons` (GET/POST) + `/api/coupons/[id]` (PATCH/DELETE)

### Каталог
- [x] **Поиск** — инпут в `CatalogFilters`, параметр `q` в URL
- [x] **Сортировка** — выпадающий список: популярные / новые / по рейтингу / дешевле / дороже; параметр `sort` в URL
- [x] **Фильтр по цене** — диапазон `minPrice`/`maxPrice` (в рублях в URL, в копейках в БД)
- [x] **Слайдер скриншотов** — `ScreenshotSlider` с превьюшками и стрелками на странице продукта

### Аналитика
- [x] **Admin дашборд** — блок «Аналитика платформы» для ADMIN: GMV всего, GMV за месяц, пользователи, новые за месяц, активные продукты, топ-5 по продажам

---

## Неделя 7 — Продуктовая зрелость ✅

**Цель:** доверие покупателей, повторные продажи, качество кода.

- [x] **Версионирование продуктов** — `ProductVersion` модель, `POST /api/products/[id]/versions`, форма загрузки новой версии в кабинете, уведомление всех покупателей (Telegram + email)
- [x] **Telegram Login Widget** — кастомный NextAuth Credentials-провайдер (`id: "telegram"`), `verifyTelegramAuth` с HMAC-SHA256, `TelegramLoginButton` компонент
- [x] **Email-уведомления** — nodemailer; дублируют: продажа, одобрение, отказ, спор, покупка, новая версия
- [x] **E2E-тесты** — Playwright: auth, catalog, purchase-flow (API guards, settings, admin, download)
- [x] **Мониторинг** — `@sentry/nextjs`, `sentry.*.config.ts`, `instrumentation.ts`, DSN в `.env.example`
- [x] **og-default.svg** — заглушка в `public/` для OG-тегов каталога и главной

---

## Неделя 8 — Монетизация ✅

### Тарифные слоты
- [x] `src/lib/developer-plan.ts` — проверка лимита: `usedSlots` считается динамически через `db.product.count({ where: { authorId, status: { in: ["PENDING","APPROVED","SUSPENDED"] } } })`, поле `usedSlots` в модели не хранится
- [x] `src/app/api/developer/slots/route.ts` — купить пакет слотов → создать платёж ЮKassa с `metadata: { type: "slots", userId, slotsAdded }`
- [x] `src/app/api/developer/pro/route.ts` — Pro подписка → создать платёж ЮKassa с `metadata: { type: "pro", userId }`
- [x] Обновить `src/app/api/payment/webhook/route.ts` — добавить ветку `metadata.type`: `"slots"` → `SlotPurchase` + `DeveloperPlan.totalSlots += slotsAdded`; `"pro"` → `DeveloperPlan.plan = "PRO"`, `proUntil = now() + 30 days`
- [x] Обновить `src/app/submit/page.tsx` + `SlotGate.tsx` — блокер с кнопками покупки слотов и Pro

### AI-ревью
- [x] `src/lib/ai-review/provider.ts` — абстракция провайдера: `AI_REVIEW_PROVIDER=gemini|ollama|yandexgpt|disabled`
- [x] `src/lib/ai-review/extract-snippets.ts` — скачать файл из S3, распаковать (zip/epf → tmpdir), нарезать фрагменты (~8k символов)
- [x] `src/lib/ai-review/prompt.ts` — промпт + парсинг JSON-ответа; провайдер не захардкожен
- [x] `src/app/api/ai-review/route.ts` — `POST`: создать `AiReview(PENDING)` → платёж ЮKassa; `GET`: список ревью текущего пользователя
- [x] Обновить `src/app/api/payment/webhook/route.ts` — ветка `"ai_review"` → `AiReview.status = "PROCESSING"`
- [x] `src/app/api/cron/ai-review/route.ts` — обрабатывает `PROCESSING` пачками по 5; защита через `x-cron-secret`
- [x] `src/app/ai-reviews/page.tsx` — кабинет покупателя «Мои AI-ревью»
- [x] `src/components/product/AiReviewCard.tsx` — отображение отчёта: общая оценка, категории, предупреждения, вердикт
- [x] `src/components/product/AiReviewOrder.tsx` — блок на странице продукта: заказ или готовый результат
- [x] Обновить `src/app/product/[slug]/page.tsx` — подключить `AiReviewOrder`

## Монетизация

### Тарифы разработчика

| Тариф | Цена | Продукты | Комиссия | Модерация |
|-------|------|----------|----------|-----------|
| Бесплатный | ₽ 0 | 2 слота | 20% | Стандарт |
| +1 слот | ₽ 490 (разово) | +1 навсегда | 20% | Стандарт |
| +5 слотов | ₽ 1 990 (разово) | +5 навсегда | 20% | Стандарт |
| +15 слотов | ₽ 4 990 (разово) | +15 навсегда | 20% | Стандарт |
| Pro | ₽ 990/мес | Неограниченно | **17%** | Приоритет (12ч) |

Pro окупается при ~7 продажах по ₽5 000 в месяц (экономия 3% комиссии = ₽1 050 → покрывает подписку).

### AI-ревью для покупателей

Покупатель может заказать независимый AI-аудит кода до покупки продукта.
- Цена: **₽ 390** за ревью
- Результат сохраняется в личном кабинете покупателя («Мои AI-ревью») — отчёт доступен бессрочно
- Провайдер настраивается через `AI_REVIEW_PROVIDER`: `gemini` / `ollama` / `yandexgpt` — код не зависит от конкретной модели

**Что входит в ревью:**
- Общая оценка (1–10)
- Оценки по категориям: качество кода, безопасность, соответствие описанию, простота установки, документация
- Скрытые требования (хостинг, сторонние API, лицензии)
- Замечания и предупреждения
- Список «подходит для»
- Итоговый вердикт

### Новые модели Prisma (добавить в schema.prisma)

```prisma
model DeveloperPlan {
  id          String    @id @default(cuid())
  userId      String    @unique
  plan        String    @default("FREE")   // FREE | PRO
  totalSlots  Int       @default(2)        // 2 бесплатных + купленные доп. слоты
  proUntil    DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  user        User      @relation(fields: [userId], references: [id])
  // usedSlots не хранится — вычисляется динамически через db.product.count
}

model SlotPurchase {
  id          String   @id @default(cuid())
  userId      String
  slotsAdded  Int
  amount      Int      // в копейках
  paymentId   String?
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])
}

model AiReview {
  id          String   @id @default(cuid())
  productId   String
  requestedBy String   // userId покупателя
  paymentId   String?
  status      String   @default("PENDING")  // PENDING | PROCESSING | DONE | FAILED
  result      Json?    // структурированный ответ от AI
  amount      Int      @default(39000)       // 390 руб в копейках
  createdAt   DateTime @default(now())
  completedAt DateTime?
  product     Product  @relation(fields: [productId], references: [id])
  requester   User     @relation(fields: [requestedBy], references: [id])
  // без @@unique — пользователь может заказать повторный аудит после обновления продукта

  @@index([requestedBy])
  @@index([status])
}

// Добавить в model User:
// developerPlan   DeveloperPlan?
// slotPurchases   SlotPurchase[]
// aiReviews       AiReview[]     @relation("AiReviewRequester")
```

### Новые API маршруты (добавить в таблицу)

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/developer/plan` | Текущий тариф, слоты (totalSlots, usedSlots computed) |
| POST | `/api/developer/slots` | Купить пакет слотов → ЮKassa (`metadata.type: "slots"`) |
| POST | `/api/developer/pro` | Оформить Pro подписку → ЮKassa (`metadata.type: "pro"`) |
| POST | `/api/ai-review` | Заказать AI-ревью → ЮKassa → `AiReview(PENDING)` |
| GET | `/api/ai-review` | Список всех ревью текущего пользователя |
| GET | `/api/cron/ai-review` | Обработка очереди `PROCESSING` (системный cron, 5 мин) |

### Промпт для AI-ревью (src/lib/ai-review/prompt.ts)

```typescript
// Провайдер абстрагирован через AI_REVIEW_PROVIDER (.env)
// Один и тот же промпт отправляется в Gemini / Ollama / YandexGPT
const prompt = `
Ты — опытный технический аудитор программного обеспечения.
Проанализируй следующий продукт и верни ТОЛЬКО валидный JSON без лишнего текста.

Название: ${product.title}
Категория: ${product.category}
Описание разработчика: ${product.fullDesc}
Заявленные функции: ${product.features.join(', ')}
Результаты автоматического сканера безопасности: ${JSON.stringify(scanFindings)}
Исходный код (фрагменты): ${codeSnippets}

Верни JSON строго по этой схеме:
{
  "overall_score": <число 1-10>,
  "quality":       { "score": <1-10>, "summary": "<строка>", "issues": ["..."] },
  "security":      { "score": <1-10>, "summary": "<строка>", "issues": ["..."] },
  "accuracy":      { "score": <1-10>, "summary": "<строка>", "missing": ["..."] },
  "installation":  { "score": <1-10>, "complexity": "EASY|MEDIUM|HARD", "requirements": ["..."] },
  "docs":          { "score": <1-10>, "summary": "<строка>" },
  "hidden_costs":  ["<строка>"],
  "recommended_for": ["<строка>"],
  "verdict":       "<1-2 предложения итогового заключения>"
}
`
```

---

## Ключевые решения для помни

1. **Slug** генерируется из названия + cuid suffix: `bot-dlya-zapisi-klientov-abc123`
2. **Файлы** в S3 хранятся по пути: `products/{productId}/source/{filename}`
3. **Скриншоты** хранятся: `products/{productId}/screenshots/{index}.jpg`
4. **Download URL** одноразовый: expires 900 сек, инкрементируем `downloadCount`
5. **Webhook ЮKassa** — обязательно проверять `X-Idempotence-Key` и IP-адрес
6. **Сканер** запускается асинхронно — результат пишем в `ScanResult` и уведомляем модератора
7. **Категория TELEGRAM** имеет доп. поле `telegramBotUsername` для проверки демо-бота
8. **Формат .epf** — проверяется BSL-паттернами (`Shell(`, `Выполнить(` и т.п.); отдельный v8unpack в образ не ставится
9. **Escrow cron** — нет встроенного планировщика; системный `crontab` на сервере дёргает `/api/cron/escrow` (раз в час) и `/api/cron/ai-review` (раз в 5 мин) с `x-cron-secret`; каждый прогон пишет `CronHeartbeat`
10. **Сканер в Docker** — `bandit`, `semgrep`, `oletools` ставятся `pip3 --break-system-packages` в стадии runner (тем же python3, что и запускает); вызов через `child_process` с таймаутом на инструмент
