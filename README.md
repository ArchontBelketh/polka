# ПОЛКА — Маркетплейс готовых программных продуктов

Платформа для продажи и покупки готовых программных решений: Telegram-боты, парсеры, Excel-скрипты, автоматизация, веб-сервисы.

---

## Стек

| Слой | Технология |
|------|-----------|
| Framework | Next.js 16 (App Router) + TypeScript |
| База данных | PostgreSQL 15 + Prisma ORM |
| Аутентификация | NextAuth.js v5 (email + credentials) |
| Хранилище | Yandex Object Storage (S3-совместимый) |
| Платежи | ЮKassa REST API |
| Стили | Tailwind CSS + shadcn/ui |
| Сканер кода | bandit, semgrep, olevba, v8unpack |
| Деплой | Hetzner CX21 + Docker Compose |

---

## Быстрый старт

```bash
# 1. Зависимости
npm install

# 2. Поднять БД
docker compose up -d db

# 3. Применить миграции и сгенерировать Prisma-клиент
npx prisma migrate dev
npx prisma generate

# 4. Заполнить тестовыми данными
npx tsx prisma/seed.ts

# 5. Запустить dev-сервер
npm run dev
```

Скопируйте `.env.example` → `.env.local` и заполните переменные.

---

## Переменные среды

| Переменная | Описание |
|-----------|----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Случайная строка (openssl rand -base64 32) |
| `NEXTAUTH_URL` | Базовый URL приложения |
| `TELEGRAM_BOT_TOKEN` | Токен бота для уведомлений |
| `YANDEX_S3_*` | Ключи и настройки Yandex Object Storage |
| `YOOKASSA_SHOP_ID` | ID магазина в ЮKassa |
| `YOOKASSA_SECRET_KEY` | Секретный ключ ЮKassa |
| `NEXT_PUBLIC_APP_URL` | Публичный URL (для OG-тегов и JSON-LD) |
| `COMMISSION_RATE` | Комиссия платформы (по умолчанию `0.20`) |
| `ESCROW_DAYS` | Срок удержания средств (по умолчанию `7`) |
| `CRON_SECRET` | Секрет для защиты `/api/cron/escrow` |

---

## Деплой

```bash
# Первый деплой — создать директорию и скопировать .env.local на сервер
ssh user@host "mkdir -p /opt/polka"
scp .env.local user@host:/opt/polka/.env.local

# Деплой
./scripts/deploy.sh <host> [user]
# или через переменные среды
DEPLOY_HOST=1.2.3.4 DEPLOY_USER=root ./scripts/deploy.sh
```

Скрипт выполняет: rsync исходников → `docker compose build` → `prisma migrate deploy` → `docker compose up -d`.

---

## Что реализовано

### Неделя 1 — Фундамент
- Prisma-схема: `User`, `Product`, `Purchase`, `Review`, `Payout`, `ScanResult`, `ModerationLog`
- NextAuth.js: email/password аутентификация, JWT-сессии
- Каталог с фильтрацией по категориям и поиском
- Страница продукта (статика)
- Navbar, тёмная тема, shadcn/ui компоненты

### Неделя 2 — Загрузка и модерация
- 5-шаговая форма загрузки продукта (`/submit`)
- Presigned S3 URL для загрузки файлов и скриншотов
- Авто-сканер кода: bandit (Python), semgrep, olevba (.xlsm), BSL-паттерны (.epf)
- Панель модератора: очередь (`/admin/queue`), карточка проверки с результатами сканера
- API модерации: `APPROVED` / `REJECTED` / `CHANGES_REQUESTED` / `SUSPENDED`
- Кабинет разработчика: список своих продуктов со статусами (`/dashboard/products`)

### Неделя 3 — Платежи и доставка
- Интеграция ЮKassa: создание платежа, обработка webhook
- Эскроу: 7-дневное удержание средств после оплаты
- Скачивание файла через presigned S3 URL (900 сек, +`downloadCount`)
- Страница покупок покупателя (`/purchases`) с кнопкой «Скачать»
- Кабинет разработчика: баланс, эскроу, последние продажи (`/dashboard`)
- Вывод средств: запрос и история (`/dashboard/payouts`)
- Cron-эндпоинт для разблокировки эскроу (`/api/cron/escrow`)

### Неделя 4 — Запуск
- Отзывы: POST требует PAID/DELIVERED покупку, пересчёт `Product.rating` атомарно
- Споры: покупатель открывает, модератор разрешает (`REFUNDED` или `DELIVERED`)
- Telegram-уведомления разработчику: новая продажа, одобрение/отказ, открытие спора
- JSON-LD structured data (`SoftwareApplication` + `AggregateRating`) на странице продукта
- OpenGraph + Twitter Card метаданные на каталоге и страницах продуктов
- Multi-stage Dockerfile (builder → scanner-tools → runner) с `output: standalone`
- `scripts/deploy.sh` — деплой на Hetzner через rsync + SSH

---

## API

| Метод | URL | Описание | Доступ |
|-------|-----|----------|--------|
| GET | `/api/products` | Список продуктов | Все |
| POST | `/api/products` | Создать черновик | Developer |
| POST | `/api/upload` | Presigned S3 URL | Developer |
| POST | `/api/scan` | Запустить сканер | Developer/Admin |
| POST | `/api/moderation/[id]` | Одобрить / отклонить | Moderator |
| POST | `/api/payment/create` | Создать платёж ЮKassa | Buyer |
| POST | `/api/payment/webhook` | Webhook от ЮKassa | System |
| GET | `/api/download/[purchaseId]` | Signed S3 URL (15 мин) | Buyer |
| GET/POST | `/api/reviews` | Список / создать отзыв | All / Buyer |
| GET/POST | `/api/disputes` | Список / открыть спор | Buyer / Moderator |
| GET/POST | `/api/payouts` | Список / запросить вывод | Developer |
| POST | `/api/cron/escrow` | Разблокировать эскроу | Cron (secret) |

---

## Следующие шаги

### Критические для запуска
- [ ] **SSL + reverse proxy** — настроить Caddy или Nginx с автоматическим Let's Encrypt на сервере; пример конфига для Caddy: `polka.app { reverse_proxy localhost:3000 }`
- [ ] **Webhook ЮKassa на продакшн-URL** — зарегистрировать `https://polka.app/api/payment/webhook` в личном кабинете ЮKassa; проверить что IP-фильтрация включена на nginx
- [ ] **Системный cron для эскроу** — добавить в crontab сервера: `0 3 * * * curl -s -X POST https://polka.app/api/cron/escrow -H "x-cron-secret: $CRON_SECRET"`
- [ ] **Telegram Login Widget** — реализовать кастомный NextAuth-провайдер через `Credentials` с проверкой init data hash по `TELEGRAM_BOT_TOKEN` (описано в `src/lib/auth.ts`)
- [ ] **Регистрация разработчика** — добавить поля ИНН и реквизиты для выплат при регистрации с ролью DEVELOPER

### Продуктовые улучшения
- [ ] **Email-уведомления** — дублировать Telegram-уведомления через `nodemailer` или Resend для пользователей без Telegram
- [ ] **Страница профиля разработчика** — `/developer/[id]` со списком продуктов, рейтингом, количеством продаж
- [ ] **Демо-превью** — встроенный просмотр скриншотов (слайдер) вместо одного изображения
- [ ] **Промокоды и скидки** — модель `Coupon` в схеме, поле `couponCode` в форме оплаты
- [ ] **Версионирование продуктов** — разработчик загружает обновление, покупатели получают уведомление и доступ к новой версии
- [ ] **Избранное** — модель `Wishlist`, кнопка «В избранное» на карточке продукта

### Технический долг
- [ ] **og-default.png** — добавить файл-заглушку в `public/` для OG-тегов каталога
- [ ] **Rate limiting** — добавить ограничение запросов на `/api/upload`, `/api/reviews`, `/api/payment/create` через middleware (например, `@upstash/ratelimit`)
- [ ] **E2E-тесты** — покрыть Playwright'ом критический путь: регистрация → загрузка продукта → покупка → скачивание
- [ ] **Мониторинг** — интегрировать Sentry для отслеживания ошибок в продакшне
- [ ] **Индексы БД** — добавить индекс на `Purchase.escrowUntil` для эффективной работы cron-запроса
