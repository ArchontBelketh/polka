# Редеплой CYBERПОЛКИ — рабочая инструкция

Короткий проверенный порядок обновления прода. Сервер: Ubuntu VPS, стек в Docker
Compose (`/opt/polka`), nginx + HTTPS. Домен: `cyberpolka.store`.

> Все команды на сервере — из `/opt/polka`. Для краткости:
> ```bash
> DC="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
> ```

---

## 0. Собрать архив (локально)

Собирается `polka-deploy.zip` — только исходники, без `node_modules`/`.next`/секретов.

```bash
bash scripts/make-release.sh
```
Если `zip` недоступен (Windows) — архив собирается тем же способом через .NET ZipFile
(пути через `/`). Результат — `polka-deploy.zip` в корне.

## 1. Залить на сервер

Батником (pscp) в `/root/polka-deploy.zip`, либо:
```bash
scp polka-deploy.zip root@85.198.84.115:/root/
```

## 2. Проверки перед сборкой (важно!)

```bash
free -h            # Swap должен быть ~4,0Gi (иначе сборка виснет по OOM)
df -h /            # Use% < ~85%; если больше — сначала prune (ниже)
docker system prune -af && docker builder prune -af   # освободить место (безопасно, pgdata не трогается)
```
Если swap пропал — вернуть:
```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && \
sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 3. Распаковать (с удалением старого кода!)

`unzip -o` только добавляет/перезаписывает — **удалённые в новой версии файлы он НЕ убирает**,
и они ломают сборку. Поэтому `src` сносим и распаковываем заново (весь код есть в архиве):

```bash
cd /opt/polka
rm -rf src
unzip -o /root/polka-deploy.zip -d /opt/polka
```
`.env`, БД и `pgdata` при этом не затрагиваются.

## 4. Проверить `.env` (если менялись переменные)

```bash
nano /opt/polka/.env
```
Актуальные ключи:
- Платежи (Т-Банк): `TBANK_TERMINAL_KEY`, `TBANK_PASSWORD`.
- S3, SMTP, Telegram, `ALLOWED_EMAIL_DOMAINS`, `ACCESS_GUARD_*`, `AI_REVIEW_PROVIDER`, `CRON_SECRET`.

## 5. Сборка → схема → запуск

Порядок важен: сначала образ, потом схема (`db push`), потом старт.
```bash
cd /opt/polka
$DC build                    # собирает образ app
$DC run --rm migrate         # применяет схему БД (prisma db push) — лёгкий образ migrator
$DC up -d                    # (пере)запускает app + db
```
> `migrate` собирается из лёгкой стадии `migrator` (только prisma CLI + схема),
> а не из полного `builder` — поэтому не упирается в диск.

## 6. Внешние настройки (разово / при изменениях)

- **Notification URL** в кабинете Т-Банка → `https://cyberpolka.store/api/payment/webhook`.
- **Cron** (`crontab -e`), подставить `CRON_SECRET`:
  ```cron
  */5 * * * * curl -fsS -H "x-cron-secret: $CRON_SECRET" https://cyberpolka.store/api/cron/ai-review    >/dev/null 2>&1
  0 * * * *   curl -fsS -H "x-cron-secret: $CRON_SECRET" https://cyberpolka.store/api/cron/hold-release >/dev/null 2>&1
  ```

## 7. Проверка

```bash
$DC ps                                          # app и db — healthy
$DC logs -f app                                 # без ошибок старта
curl -s https://cyberpolka.store/api/health     # {"ok":true}
```
Открыть каталог и кабинет — без 500. При изменении платежей — тест-платёж на ₽1
(покупка должна перейти в PAID).

---

## Быстрый путь (когда ничего экзотического)

```bash
# локально: bash scripts/make-release.sh  → залить в /root
cd /opt/polka
docker system prune -af && docker builder prune -af
rm -rf src && unzip -o /root/polka-deploy.zip -d /opt/polka
DC="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
$DC build && $DC run --rm migrate && $DC up -d
curl -s https://cyberpolka.store/api/health
```

---

## Если что-то пошло не так

| Симптом | Причина / решение |
|---|---|
| `Export X doesn't exist` при сборке | Осиротевший старый файл в `src`. Сделать `rm -rf src` перед `unzip`. |
| `no space left on device` | Диск полный. `docker system prune -af && docker builder prune -af`; проверить `df -h /`. Сборка `migrate` больше не дублирует образ, но место всё равно нужно. |
| Сборка виснет >700с | Нет swap → OOM. Проверить `free -h`, вернуть 4 ГБ swap (шаг 2). |
| `unknown option --skip-generate` | В Prisma 7 флага нет. Команда — просто `npx prisma db push` (уже поправлено в compose). |
| `prisma:warn ... openssl` | Предупреждение, не ошибка — push проходит. |
| 500 на кабинете/продуктах после деплоя | Не применилась схема. Выполнить `$DC run --rm migrate`. |
| `create-admin` через migrate не работает | Слим-`migrator` умеет только `db push`. Реальный админ создаётся на первичной установке (`server-setup.sh`); дополнительный — отдельной задачей. |
