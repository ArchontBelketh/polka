# Инструкция по деплою — CYBERПОЛКА

## Содержание
1. [Требования](#1-требования)
2. [Локальная разработка](#2-локальная-разработка)
3. [Переменные окружения](#3-переменные-окружения)
4. [База данных](#4-база-данных)
5. [Docker Compose (staging / тест-сервер)](#5-docker-compose)
6. [Продакшн без Docker](#6-продакшн-без-docker)
7. [Продакшн c Docker](#7-продакшн-с-docker)
8. [Внешние сервисы](#8-внешние-сервисы)
9. [Чеклист после деплоя](#9-чеклист-после-деплоя)

---

## 1. Требования

| Компонент | Минимум |
|---|---|
| Node.js | 22 LTS |
| npm | 10+ |
| PostgreSQL | 15+ |
| Python | 3.10+ (для сканера) |
| Docker | 24+ (опционально) |
| RAM | 1 ГБ (2+ рекомендуется) |

Инструменты сканера (устанавливаются через pip; необязательны, без них продукты уходят в ручную очередь):

```bash
pip install bandit semgrep oletools   # oletools даёт CLI olevba (.xlsm/.docm)
```
> В Docker-образе они ставятся автоматически в стадии runner тем же `python3`,
> который их запускает. `.epf` (1С) проверяются BSL-паттернами без v8unpack.

---

## 2. Локальная разработка

```bash
# 1. Клонировать репозиторий
git clone <repo-url>
cd polka

# 2. Установить зависимости
npm install

# 3. Скопировать и заполнить переменные окружения
cp .env.example .env.local

# 4. Поднять PostgreSQL (или использовать внешний)
docker run -d \
  --name polka-db \
  -e POSTGRES_USER=polka \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=polka_db \
  -p 5432:5432 \
  postgres:15

# 5. Применить схему и засеять ДЕМО-данные (только для разработки)
npm run db:push
npm run db:seed:demo                    # демо-продукты (dev-only)
npx tsx scripts/seed-test-users.ts      # тестовые учётки (dev-only)

# 6. Запустить dev-сервер
npm run dev
```

Приложение доступно на http://localhost:3000

> **Демо-сиды защищены от прода.** `seed-demo.ts`, `seed-test-users.ts` и
> `seed-e2e-scenario.ts` бросают ошибку при `NODE_ENV=production` (если не задан
> `ALLOW_DEMO_SEED=1`). На проде запускается только безопасный `npm run db:seed`
> (без демо-данных), а реальный админ создаётся отдельным скриптом — см. §7.

### Тестовые учётные записи (только dev, после `seed-test-users`)

| Email | Пароль | Роль |
|---|---|---|
| dev@polka.test | password123 | Разработчик |
| buyer@polka.test | password123 | Покупатель |
| moderator@polka.test | password123 | Модератор |
| admin@polka.test | password123 | Администратор |

---

## 3. Переменные окружения

Создать файл `.env.local` (для локальной разработки) или `.env` (для продакшна). Все доступные переменные с комментариями описаны в `.env.example`.

### Обязательные переменные

```env
DATABASE_URL="postgresql://polka:password@localhost:5432/polka_db"
NEXTAUTH_SECRET="<сгенерировать: openssl rand -base64 32>"
NEXTAUTH_URL="https://your-domain.com"
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

### Объектное хранилище (Yandex Cloud S3)

Файлы продуктов хранятся в S3. Без S3 скан файлов не выполняется, продукты идут в ручную очередь.

```env
YANDEX_S3_ACCESS_KEY="..."
YANDEX_S3_SECRET_KEY="..."
YANDEX_S3_BUCKET="polka-files"
YANDEX_S3_ENDPOINT="https://storage.yandexcloud.net"
YANDEX_S3_REGION="ru-central1"
```

### AI-ревью (опционально)

Выбрать один из трёх провайдеров или отключить:

```env
AI_REVIEW_PROVIDER="gemini"   # gemini | ollama | yandexgpt | disabled

# Вариант A — Gemini (Google AI Studio)
GEMINI_API_KEY="..."

# Вариант B — Ollama (локально, напр. gemma3:12b)
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="gemma3:12b"

# Вариант C — YandexGPT
YANDEX_GPT_API_KEY="..."
YANDEX_FOLDER_ID="..."
```

### VirusTotal (опционально)

Только hash-lookup, файлы не загружаются. Бесплатный план: 4 запроса/мин, 500/день.

```env
VIRUSTOTAL_API_KEY="..."   # оставить пустым — VirusTotal отключён
```

### Платежи, Telegram, Email

```env
YOOKASSA_SHOP_ID="..."
YOOKASSA_SECRET_KEY="..."

TELEGRAM_BOT_TOKEN="..."
TELEGRAM_BOT_SECRET="..."
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME="your_bot_username"

SMTP_HOST="smtp.yandex.ru"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="noreply@polka.app"
SMTP_PASS="..."
SMTP_FROM="CYBERПОЛКА <support@your-domain.com>"
```

> `SMTP_FROM` в `env_file` берётся целиком как значение — кавычки внутри (`\"`)
> ломают парсинг. Оборачивайте всю строку в двойные кавычки без вложенных.

### Ограничение регистрации и доступа (опционально)

```env
# Разрешённые домены почты при регистрации (пусто — любые)
ALLOWED_EMAIL_DOMAINS="yandex.ru, gmail.com"
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS="yandex.ru, gmail.com"   # для подсказки на форме

# Анти-VPN/прокси/дата-центр/гео — главный рубильник + тумблеры
ACCESS_GUARD_ENABLED="1"            # пусто — модуль выключен, нулевые накладные
ACCESS_GUARD_VPN_API="1"            # блок VPN/прокси по API репутации
ACCESS_GUARD_ASN="1"                # блок дата-центровых ASN
ACCESS_GUARD_GEO=""                 # только ACCESS_GUARD_ALLOWED_COUNTRIES
ACCESS_GUARD_API_PROVIDER="proxycheck"   # proxycheck | vpnapi
ACCESS_GUARD_API_KEY="..."
ACCESS_GUARD_ALLOWLIST=""           # свои IP/CIDR в обход
```
> Подробно — [src/lib/access-guard/README.md](src/lib/access-guard/README.md). Это
> рантайм-переменные: меняются без пересборки (`up -d --force-recreate app`).

### Sentry (опционально)

Source maps загружаются в Sentry только при наличии `SENTRY_AUTH_TOKEN`.

```env
SENTRY_DSN="https://..."
NEXT_PUBLIC_SENTRY_DSN="https://..."
SENTRY_AUTH_TOKEN="..."
SENTRY_ORG="your-org"
SENTRY_PROJECT="polka"
```

---

## 4. База данных

### Первичная инициализация

```bash
# Применить схему (создаёт таблицы, не удаляет данные)
npm run db:push

# Безопасный сид (без демо-данных и тест-аккаунтов)
npm run db:seed

# Создать реального админа со стойким паролем
npx tsx scripts/create-admin.ts --email admin@your-domain --password 'СтойкийПароль!'
```

> **Не запускайте на проде** `db:seed:demo` или `seed-test-users.ts` — они создают
> демо-продукты и учётки `*@polka.test` с публичным паролем. Эти скрипты защищены
> guard-ом (`NODE_ENV=production` → ошибка), но не полагайтесь только на него.

### Обновление схемы при деплое новой версии

```bash
# Сгенерировать клиент после изменений schema.prisma
npm run db:generate

# Применить изменения (для продакшна используйте миграции)
npm run db:push
```

### Продакшн: использование миграций вместо db:push

Для продакшна рекомендуется Prisma Migrate вместо `db:push`:

```bash
# Создать миграцию
npx prisma migrate dev --name your_migration_name

# Применить все pending-миграции (CI/CD, деплой)
npx prisma migrate deploy
```

---

## 5. Docker Compose

Быстрый запуск всего стека (БД + приложение):

```bash
# Собрать образ и запустить
docker compose up -d --build

# Применить схему (первый запуск)
docker compose exec app npx prisma db push
docker compose exec app npm run db:seed:demo   # только для локального стека

# Логи
docker compose logs -f app

# Остановить
docker compose down

# Остановить и удалить данные БД
docker compose down -v
```

> **Внимание:** `docker-compose.yml` читает переменные из `.env.local`. Убедитесь, что файл создан и `DATABASE_URL` указывает на контейнер `db`: `postgresql://polka:password@db:5432/polka_db`

### Продакшн-стек (с изоляцией БД)

В проде запускайте с override-файлом — он убирает проброс порта БД наружу и требует
стойкий пароль:

```bash
# .env рядом с compose-файлами (для интерполяции compose):
#   POSTGRES_PASSWORD=$(openssl rand -base64 24)
# тот же пароль — в DATABASE_URL приложения (env_file .env)

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# firewall хоста
sudo ufw allow 22,80,443/tcp && sudo ufw enable

# доступ к БД для psql/бэкапов — без проброса порта:
docker compose exec db psql -U polka -d polka_db
```

> В базовом `docker-compose.yml` порт БД биндится на `127.0.0.1` (только хост),
> в проде override (`ports: !reset []`) убирает его полностью — приложение
> ходит к БД по имени `db` внутри сети compose.

---

## 6. Продакшн без Docker

```bash
# 1. Установить зависимости
npm ci --omit=dev

# 2. Сгенерировать Prisma-клиент
npm run db:generate

# 3. Собрать Next.js
npm run build

# 4. Применить миграции БД
npx prisma migrate deploy

# 5. Запустить
npm start
```

Для управления процессом рекомендуется PM2:

```bash
npm install -g pm2
pm2 start npm --name polka -- start
pm2 save
pm2 startup
```

### Nginx (reverse proxy)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    client_max_body_size 100M;

    # Security headers (§2.5 readiness)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    # CSP — добавить отдельной задачей через Content-Security-Policy-Report-Only

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 7. Продакшн с Docker

### Сборка образа

```bash
# Собрать
docker build -t polka:latest .

# Или с тегом версии
docker build -t polka:$(git rev-parse --short HEAD) .
```

### Запуск контейнера

```bash
docker run -d \
  --name polka \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  polka:latest
```

### Переменная DATABASE_URL для Docker

При запуске вне docker-compose нужно указывать внешний адрес БД:

```env
DATABASE_URL="postgresql://polka:password@<host>:5432/polka_db"
```

### Применить схему при первом запуске

```bash
docker exec polka npx prisma migrate deploy
docker exec polka npm run db:seed                                  # безопасный сид (без демо)
docker exec polka npx tsx scripts/create-admin.ts --email admin@your-domain
# демо-сиды (db:seed:demo / seed-test-users) на проде НЕ запускать
```

---

## 8. Внешние сервисы

### Telegram Bot

1. Создать бота через [@BotFather](https://t.me/BotFather), получить `TELEGRAM_BOT_TOKEN`
2. Установить webhook:
   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/api/telegram/webhook&secret_token=<TELEGRAM_BOT_SECRET>
   ```

### Yandex Object Storage

1. Создать бакет в Yandex Cloud Console
2. Создать сервисный аккаунт с ролью `storage.editor`
3. Создать статический ключ → заполнить `YANDEX_S3_ACCESS_KEY` и `YANDEX_S3_SECRET_KEY`
4. Настроить CORS в настройках бакета (разрешить `PUT`/`GET` с вашего домена)

### YooKassa

1. Зарегистрироваться на [yookassa.ru](https://yookassa.ru)
2. В настройках магазина получить `shopId` и создать `secretKey`
3. Настроить webhook URL: `https://your-domain.com/api/payment/webhook`

### VirusTotal

1. Зарегистрироваться на [virustotal.com](https://virustotal.com)
2. Перейти на [virustotal.com/gui/my-apikey](https://virustotal.com/gui/my-apikey)
3. Скопировать ключ в `VIRUSTOTAL_API_KEY`

---

## 8.5. Резервное копирование, cron и мониторинг

Скрипты лежат в `scripts/` и рассчитаны на сервер с Docker-стеком. Параметры берутся
из env-файла (например `/opt/polka/backup.env`) — см. переменные в `.env.example`
(`BACKUP_S3_*`, `AWS_ACCESS_KEY_ID/SECRET`, `TELEGRAM_*`).

### Бэкапы (§1.2)

- **Отдельный бакет** `polka-backups` с **отдельным сервисным аккаунтом** — его ключи
  НЕ должны совпадать с `YANDEX_S3_*` (если утекут ключи приложения, бэкапы должны уцелеть).
- Включить **versioning** на бакете `polka-files` (файлы продуктов) — защита от перезаписи.
- **Проверить restore хотя бы раз до запуска** — бэкап без проверенного восстановления не считается.

```bash
# ночной дамп в S3
set -a; . /opt/polka/backup.env; set +a
/opt/polka/scripts/backup.sh

# проверяемый restore во временную БД (неразрушающий) — счётчики строк на выходе
/opt/polka/scripts/restore.sh polka_2026-06-12_0300.sql.gz
```

> **Боевой restore после аварии** (в живую БД): остановить `app`, создать чистую БД,
> `gunzip -c backup.sql.gz | docker compose exec -T db psql -U polka -d polka_db`,
> поднять `app`. Делать осознанно — операция перезаписывает данные.

### Cron-задачи (§1.3)

Без этого **оплаченные AI-ревью висят в PROCESSING**. (Эскроу отключён — выплаты
разработчику зачисляются сразу при оплате, отдельный cron для этого не нужен.)
`CRON_SECRET` — тот же, что в `.env`.

```cron
# crontab -e на сервере
0 3 * * *   set -a; . /opt/polka/backup.env; set +a; /opt/polka/scripts/backup.sh   >> /var/log/polka-backup.log 2>&1
*/5 * * * * curl -fsS -H "x-cron-secret: $CRON_SECRET" https://your-domain.com/api/cron/ai-review >> /var/log/polka-cron.log 2>&1
0 * * * *   set -a; . /opt/polka/backup.env; set +a; /opt/polka/scripts/monitor.sh  >> /var/log/polka-monitor.log 2>&1
```

> Используйте `crontab -e` с переменной `CRON_SECRET` в окружении cron (или подставьте
> значение явно). Каждый успешный вызов cron-эндпоинта пишет heartbeat в таблицу
> `CronHeartbeat`.

### Мониторинг (§1.2 + §1.3 + §2.4)

- `scripts/monitor.sh` (ежечасно) шлёт алерт в Telegram, если последний бэкап старше суток
  или cron-задача не отметилась в heartbeat в срок.
- Подключить внешний uptime-мониторинг (UptimeRobot / Betterstack) на `GET /api/health`
  с алертом в Telegram — на случай, когда «лежит весь сайт».

---

## 9. Чеклист после деплоя

- [ ] `https://your-domain.com` открывается, вкладка "CYBERПОЛКА" (внутри — "Каталог — CYBERПОЛКА")
- [ ] Вход под покупателем, разработчиком, модератором работает
- [ ] Загрузка файла в форме отправки продукта (S3 подключён)
- [ ] Сканирование запускается после отправки продукта
- [ ] Страница `/admin/queue` доступна модератору, очередь отображается
- [ ] Telegram webhook принимает сообщения (проверить в логах бота)
- [ ] Платёжный webhook настроен в личном кабинете YooKassa
- [ ] `NEXTAUTH_SECRET` содержит случайную строку (не пример из `.env.example`)
- [ ] `NEXTAUTH_URL` и `NEXT_PUBLIC_APP_URL` указывают на продакшн-домен
- [ ] HTTPS включён; HTTP редиректит на HTTPS
- [ ] Sentry DSN установлен, тестовая ошибка видна в дашборде (опционально)
- [ ] **В таблице `User` нет аккаунтов `*@polka.test`** (демо-сиды не запускались на проде)
- [ ] **Реальный админ создан** через `create-admin.ts` со стойким паролем
- [ ] nginx прокидывает `X-Real-IP $remote_addr`; вебхук ЮKassa проверяет CIDR (§1.1 readiness)
- [ ] Домен вебхука не публикует AAAA-запись (ЮKassa шлёт только по IPv4)
- [ ] `GET /api/health` отвечает `{ ok: true }`; внешний uptime-мониторинг настроен на него
- [ ] Security-заголовки присутствуют (`curl -I https://your-domain.com` → HSTS, X-Frame-Options и т.д.)
- [ ] Порт Postgres не проброшен наружу (прод-override), пароль БД сменён, `ufw` включён
- [ ] **Cron настроен**: AI-ревью (раз в 5 мин); в `/var/log/polka-cron.log` есть успешные вызовы
- [ ] **Бэкапы**: ночной `backup.sh` в отдельный бакет; **проведён проверочный `restore.sh`**; versioning на `polka-files`
- [ ] `monitor.sh` (ежечасно) шлёт тест-алерт в Telegram при просрочке бэкапа/cron

---

## Полезные команды

```bash
# Просмотр БД через веб-интерфейс
npm run db:studio

# Перезапуск в PM2
pm2 restart polka

# Логи PM2
pm2 logs polka --lines 100

# Обновление на сервере
git pull
npm ci
npm run db:generate
npx prisma migrate deploy
npm run build
pm2 restart polka
```
