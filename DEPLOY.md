# Инструкция по деплою — ПОЛКА

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
pip install bandit semgrep olevba
```

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

# 5. Применить схему и засеять тестовые данные
npm run db:push
npm run db:seed

# 6. Запустить dev-сервер
npm run dev
```

Приложение доступно на http://localhost:3000

### Тестовые учётные записи (после seed)

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
SMTP_FROM="\"ПОЛКА\" <noreply@polka.app>"
```

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

# Засеять начальные данные (тестовые пользователи, категории и т.д.)
npm run db:seed
```

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
docker compose exec app npm run db:seed

# Логи
docker compose logs -f app

# Остановить
docker compose down

# Остановить и удалить данные БД
docker compose down -v
```

> **Внимание:** `docker-compose.yml` читает переменные из `.env.local`. Убедитесь, что файл создан и `DATABASE_URL` указывает на контейнер `db`: `postgresql://polka:password@db:5432/polka_db`

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
docker exec polka npm run db:seed  # только для первичного сида
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

## 9. Чеклист после деплоя

- [ ] `https://your-domain.com` открывается, заголовок "Каталог — ПОЛКА"
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
