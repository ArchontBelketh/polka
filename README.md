# CYBERПОЛКА — Маркетплейс готовых программных продуктов

Платформа для продажи и покупки готовых программных решений: Telegram-боты, парсеры,
Excel-скрипты, автоматизация, веб-сервисы. Площадка выступает агентом-посредником между
разработчиком и покупателем: берёт на себя оплату и доставку файлов. Продажи финальные (без эскроу и возвратов).

> Прод: `https://cyberpolka.store`. Раньше проект назывался «ПОЛКА» — в коде и старых
> документах местами встречается прежнее имя.

---

## Стек

| Слой | Технология |
|------|-----------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| База данных | PostgreSQL + Prisma 7 (`@prisma/adapter-pg`, клиент в `src/generated/prisma`) |
| Аутентификация | NextAuth v5 (JWT): credentials (email+пароль) + Telegram Login |
| Хранилище файлов | Yandex Object Storage (S3-совместимый) |
| Платежи | Т-Банк (интернет-эквайринг, API v2) |
| Стили | Tailwind CSS v4 (`@theme inline`), самостоятельно захостенные шрифты |
| Сканер кода | bandit, semgrep, oletools (`olevba`), BSL-паттерны (1С) |
| AI-ревью / автомодерация | Gemini / Ollama / YandexGPT (провайдер через env) |
| Почта | SMTP (Yandex 360), nodemailer |
| Мониторинг | Sentry (все рантаймы) |
| Деплой | Ubuntu VPS + Docker Compose + nginx + Let's Encrypt |

---

## Быстрый старт (локально)

```bash
# 1. Зависимости
npm install

# 2. Поднять БД (Postgres в Docker)
docker compose up -d db

# 3. Накатить схему и сгенерировать Prisma-клиент
npm run db:push
npm run db:generate

# 4. Демо-данные и тестовые аккаунты (ТОЛЬКО для разработки)
npm run db:seed:demo                    # демо-продукты
npx tsx scripts/seed-test-users.ts      # тестовые учётки *@polka.test

# 5. Запустить dev-сервер
npm run dev                             # http://localhost:3000
```

Скопируйте `.env.example` → `.env.local` и заполните переменные. Схема управляется
через **`prisma db push`** — каталога миграций (`prisma/migrations`) в проекте нет.

> Полный гайд по локальной работе и ручному тестированию — в [TESTING.md](TESTING.md).

---

## Переменные среды

Все переменные с комментариями — в `.env.example`. Ключевые:

| Переменная | Описание |
|-----------|----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` / `AUTH_SECRET` | Секрет сессий (`openssl rand -base64 32`) |
| `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL` | Базовый и публичный URL |
| `ALLOWED_EMAIL_DOMAINS` | Ограничение доменов при регистрации (напр. `yandex.ru, gmail.com`); пусто — любые |
| `YANDEX_S3_*` | Ключи и настройки Yandex Object Storage |
| `TBANK_TERMINAL_KEY`, `TBANK_PASSWORD` | Реквизиты терминала Т-Банка |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_SECRET` | Бот для входа и уведомлений |
| `SMTP_*` | Почта (host/port/user/pass/from) |
| `AI_REVIEW_PROVIDER` | `gemini` \| `ollama` \| `yandexgpt` \| `disabled` (+ ключ провайдера) |
| `VIRUSTOTAL_API_KEY` | Опционально: hash-lookup в сканере |
| `ACCESS_GUARD_*` | Анти-VPN/прокси/гео (главный рубильник `ACCESS_GUARD_ENABLED`) — см. [модуль](src/lib/access-guard/README.md) |
| `CRON_SECRET` | Секрет для cron-эндпоинта AI-ревью; ≥32 символов |
| `COMMISSION_RATE` | Комиссия площадки (`0.20`) |
| `SENTRY_*` | Мониторинг (опционально) |

---

## Деплой

Два пути, оба через Docker Compose на Ubuntu-сервере:

- **С нуля, «под ключ»** (Docker + nginx + HTTPS автоматически) — [SERVER_DEPLOY.md](SERVER_DEPLOY.md):
  залить `polka-deploy.zip`, заполнить блок настроек в `scripts/server-setup.sh`, запустить.
- **Подробный справочник** (env, БД, бэкапы, cron, мониторинг, nginx) — [DEPLOY.md](DEPLOY.md).

Обновление версии:

```bash
bash scripts/make-release.sh                     # собрать polka-deploy.zip локально
scp polka-deploy.zip USER@IP:/root/
ssh USER@IP "unzip -o /root/polka-deploy.zip -d /opt/polka"
# на сервере:
cd /opt/polka
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## Что реализовано

**Каталог и продукт**
- Каталог с поиском, сортировкой, фильтрами по категориям и цене
- Страница продукта: описание, системные требования, «что входит», скриншот-слайдер,
  отзывы, публичный Q&A, JSON-LD + OG-теги
- Профиль разработчика `/developer/[id]`, избранное, промокоды

**Загрузка и модерация**
- Мастер загрузки `/submit` (категория → описание → функции → установка → медиа → цена)
- Автосканер: bandit / semgrep / oletools / BSL-паттерны + защита от zip-бомб + SHA-256 дедуп
- **Автомодерация**: risk-score → AUTO_APPROVE / MONITOR / очередь / AUTO_REJECT
  (см. [docs/AUTO_MODERATION.md](docs/AUTO_MODERATION.md))
- VirusTotal hash-check (опционально), бейдж «Проверено вручную»
- Версионирование продуктов с отдельной модерацией версий

**Платежи и доставка**
- Т-Банк: создание платежа (Init), верификация webhook по подписи Token
- Продажи финальные: деньги за вычетом комиссии зачисляются разработчику **сразу** после оплаты (без эскроу и возвратов)
- Отзывы (только после покупки)
- Скачивание через отдельную страницу с инструктажем + одноразовый presigned S3 URL

**Коммуникации**
- Приватный чат покупатель ↔ разработчик (тред на покупку)
- Публичный Q&A до покупки
- **Фильтр контактов** ([src/lib/contact-filter.ts](src/lib/contact-filter.ts)) — блокирует
  обмен телефоном/email/мессенджерами в Q&A и приватном чате, ловит обходы
- Уведомления: Telegram + email (nodemailer)

**Монетизация**
- Тарифные слоты (2 бесплатных) + докупка слотов + Pro-подписка (комиссия 17%)
- Самостоятельный апгрейд покупателя до разработчика (`/sell` → «Стать разработчиком»)
- AI-ревью кода по запросу покупателя (₽390)

**Безопасность и инфраструктура**
- Восстановление пароля, email-верификация, ограничение доменов регистрации
- **access-guard**: анти-VPN/прокси/дата-центр/гео с главным рубильником
- Security-заголовки + CSP-Report-Only, health-эндпоинт, бэкапы, cron-heartbeat, Sentry
- Юридический контур: оферта / политика / соглашение + чекбокс согласия

**Роли:** BUYER, DEVELOPER, MODERATOR, ADMIN. Тарифы и цены — в [ROADMAP.md](ROADMAP.md#монетизация).

---

## Основные API-маршруты

| Метод | URL | Описание | Доступ |
|-------|-----|----------|--------|
| GET/POST | `/api/products` | Список / создать черновик | Все / Developer |
| POST | `/api/upload` | Presigned S3 URL | Developer |
| POST | `/api/scan` | Запустить сканер | Developer/Admin |
| POST | `/api/moderation/[id]` | Одобрить / отклонить | Moderator |
| POST | `/api/products/[id]/versions` | Загрузить новую версию | Author |
| GET/POST | `/api/products/[id]/questions` | Q&A по продукту | Все / Auth |
| GET/POST | `/api/purchases/[id]/messages` | Приватный чат по покупке | Buyer / Author |
| POST | `/api/payment/create` | Создать платёж (Т-Банк Init) | Buyer |
| POST | `/api/payment/webhook` | Webhook Т-Банка (проверка Token) | System |
| GET | `/api/download/[purchaseId]` | Одноразовый signed S3 URL | Buyer |
| GET/POST | `/api/reviews` | Отзывы | Все / Buyer |
| GET/POST | `/api/payouts` | Вывод средств | Developer |
| POST | `/api/developer/slots` \| `/pro` \| `/upgrade` | Слоты / Pro / апгрейд роли | Developer/Buyer |
| POST | `/api/ai-review` | Заказать AI-ревью | Buyer |
| POST | `/api/cron/ai-review` | Cron-задача (очередь AI-ревью) | Cron (secret) |
| GET | `/api/health` | Healthcheck (`SELECT 1`) | Все |

---

## Документация

| Файл | О чём |
|------|-------|
| [ROADMAP.md](ROADMAP.md) | Технический справочник, схема БД, история по неделям, монетизация |
| [DEPLOY.md](DEPLOY.md) | Полный гайд деплоя: env, БД, Docker, бэкапы, cron, nginx |
| [SERVER_DEPLOY.md](SERVER_DEPLOY.md) | Быстрое развёртывание «под ключ» на свежем сервере |
| [TESTING.md](TESTING.md) | Локальный запуск и ручное тестирование по ролям |
| [docs/AUTO_MODERATION.md](docs/AUTO_MODERATION.md) | Архитектура автомодерации (risk-score, AI, VirusTotal) |
| [STOREFRONT_AND_COMMUNICATION.md](STOREFRONT_AND_COMMUNICATION.md) | Спека лендинга, /sell, сообщений, Q&A |
| [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) / [PRODUCTION_FIXES_PLAN.md](PRODUCTION_FIXES_PLAN.md) | Аудит готовности к проду и статус устранения |
| [src/lib/access-guard/README.md](src/lib/access-guard/README.md) | Модуль анти-VPN/гео |
