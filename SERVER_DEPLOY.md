# Развёртывание ПОЛКИ на сервере — быстрый старт

Эта инструкция — для свежего сервера **Ubuntu/Debian** с доступом по SSH.
Разворачивает всё «под ключ»: Docker, PostgreSQL, приложение, nginx и
бесплатный HTTPS (Let's Encrypt). Подробный справочник — в [DEPLOY.md](DEPLOY.md).

---

## Что понадобится

- Сервер Ubuntu/Debian (минимум 2 GB RAM, лучше 4 GB — на сервере идёт сборка).
- Домен, **A-запись которого уже указывает на IP сервера** (HTTPS без домена не выдать).
- Архив `polka-deploy.zip` (лежит в корне проекта; пересобрать — `bash scripts/make-release.sh`).

---

## Шаг 1. Залить архив на сервер

С вашего компьютера (PowerShell или терминал). Замените `USER` и `IP`:

```bash
scp polka-deploy.zip USER@IP:/root/
```

> Доступ по паролю — `scp`/`ssh` спросят пароль сервера.

## Шаг 2. Зайти на сервер и распаковать

```bash
ssh USER@IP

apt-get update && apt-get install -y unzip
mkdir -p /opt/polka
unzip -o /root/polka-deploy.zip -d /opt/polka
cd /opt/polka
```

## Шаг 3. Заполнить настройки и запустить установку

Откройте скрипт и впишите свои значения в блок **«НАСТРОЙКИ»** в самом верху
(домен, email, ключи S3/ЮKassa/SMTP/Telegram). Что не нужно — оставьте пустым:

```bash
nano scripts/server-setup.sh   # заполнить блок НАСТРОЙКИ сверху
sudo bash scripts/server-setup.sh
```

Дальше скрипт сделает всё сам:

1. поставит Docker, nginx, certbot, firewall;
2. создаст `.env`, перенесёт в него ваши значения из блока НАСТРОЙКИ и сгенерирует секреты (пароль БД, ключи сессий);
3. соберёт и запустит контейнеры (приложение + PostgreSQL);
4. применит схему БД;
5. **создаст администратора и покажет его пароль — сохраните его!**
6. настроит nginx и выпустит HTTPS-сертификат;
7. включит firewall (порты 22, 80, 443).

Через несколько минут сайт будет доступен по `https://ваш-домен`.

---

## Шаг 4. Дозаполнить внешние сервисы

Скрипт поднимет сайт даже с пустыми ключами, но **платежи, загрузка файлов,
письма и вход через Telegram** заработают только после заполнения ключей.
Откройте `.env` и впишите свои значения:

```bash
nano /opt/polka/.env
```

Что важно заполнить (остальное — опционально):

| Блок | Переменные |
|------|-----------|
| Хранилище файлов (S3) | `YANDEX_S3_ACCESS_KEY`, `YANDEX_S3_SECRET_KEY`, `YANDEX_S3_BUCKET` |
| Платежи (ЮKassa) | `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY` |
| Письма (SMTP) | `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_SECRET`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` |
| Ограничение почты при регистрации | `ALLOWED_EMAIL_DOMAINS`, `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS` |

После правок применить:

```bash
cd /opt/polka
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

> ⚠️ `NEXT_PUBLIC_*` (Telegram-имя, подсказка доменов) вшиваются в сборку —
> чтобы они подхватились, нужна именно пересборка (`--build`), как выше.

---

## Повседневные команды

Все — из каталога `/opt/polka`. Для краткости:

```bash
DC="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
```

| Действие | Команда |
|----------|---------|
| Логи приложения | `$DC logs -f app` |
| Статус контейнеров | `$DC ps` |
| Перезапуск / применить .env | `$DC up -d --build` |
| Остановить | `$DC down` |
| Применить новую схему БД | `$DC run --rm migrate` |
| Создать ещё админа | `$DC run --rm migrate npx tsx scripts/create-admin.ts --email NEW@domain` |
| Консоль БД | `$DC exec db psql -U polka -d polka_db` |

## Обновление до новой версии

1. Соберите новый архив локально: `bash scripts/make-release.sh`.
2. Залейте и распакуйте поверх (`.env` и данные БД не затрагиваются):
   ```bash
   scp polka-deploy.zip USER@IP:/root/
   ssh USER@IP "unzip -o /root/polka-deploy.zip -d /opt/polka"
   ```
3. На сервере:
   ```bash
   cd /opt/polka
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm migrate   # если менялась схема
   ```

Повторный запуск `scripts/server-setup.sh` тоже безопасен — он ничего не ломает.

---

## Если что-то пошло не так

- **Сертификат не выпустился** — проверьте, что `A`-запись домена указывает на сервер
  (`dig +short ваш-домен`), затем:
  `certbot --nginx -d ваш-домен --agree-tos -m ВАШ-EMAIL --redirect`
- **Сайт не открывается** — `docker compose ... logs --tail=100 app` и `systemctl status nginx`.
- **502 Bad Gateway** — приложение ещё стартует или упало; смотрите логи app и `$DC ps`.
- **Забыли пароль админа** — создайте нового: `$DC run --rm migrate npx tsx scripts/create-admin.ts --email admin@домен`.
