# Ручное тестирование CYBERПОЛКА

Все команды выполняются из папки `c:\portfolio\polka`.

## Тестовые аккаунты

Пароль у всех — `password123`.

| Email | Роль |
|---|---|
| `admin@polka.test` | ADMIN |
| `dev@polka.test` | DEVELOPER |
| `buyer@polka.test` | BUYER |
| `moderator@polka.test` | MODERATOR |

---

## База данных (Docker Postgres)

База работает в Docker-контейнере `polka-db-1` на порту **5432** (база `polka_db`,
пользователь `polka`, пароль `password`). Подключение задано в `.env.local`.

### Запустить базу

```powershell
docker compose up -d db
```

Данные сохраняются в Docker-томе `polka_pgdata` между перезапусками. После перезагрузки
компьютера Docker Desktop обычно поднимает контейнер сам; если нет — повторите команду.

### Остановить / удалить базу

```powershell
docker compose stop db        # остановить (данные сохранятся)
docker compose down           # удалить контейнер (том с данными останется)
docker compose down -v        # удалить контейнер И все данные
```

### Проверить, что база жива

```powershell
docker exec polka-db-1 pg_isready -U polka -d polka_db
```

---

## Первичная настройка (один раз / после изменения схемы)

### 1. Сгенерировать клиент Prisma (после изменений `schema.prisma`)

```powershell
npx prisma generate
```

### 2. Накатить схему на базу

```powershell
npx prisma db push
```

### 3. Засеять тестовые данные

Скрипты сами читают `.env.local`, ручной `DATABASE_URL` указывать не нужно.

```powershell
npm run db:seed:demo                   # 6 демо-продуктов + демо-автор (dev-only)
npx tsx scripts/seed-test-users.ts     # 4 тестовых аккаунта (см. таблицу выше)
```

---

## Запуск приложения

```powershell
npm run dev
```

Приложение доступно на **http://localhost:3000**

Остановить — `Ctrl+C` в терминале. Если сервер запущен в фоне и порт занят
(или после нескольких перезапусков накопились «осиротевшие» процессы, из-за которых
все маршруты отдают 500 и в логе `Another write batch ... already active`):

```powershell
# убить всё, что слушает :3000, и все node-процессы next dev
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select -Expand OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'next' -and $_.CommandLine -match 'dev' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Remove-Item .next -Recurse -Force    # затем чистый старт
```

> Если при старте Turbopack ругается на повреждённый кэш (`corrupted database`,
> `Failed to restore task data`) — удалите кэш и запустите снова:
> ```powershell
> Remove-Item .next -Recurse -Force
> npm run dev
> ```

---

## Просмотр базы данных визуально (Prisma Studio)

```powershell
npm run db:studio
```

В консоли появится строка вида `Prisma Studio is running at: http://localhost:XXXXX` —
**откройте именно тот адрес и порт, который он напечатал** (порт назначается автоматически
и может меняться). Слева — список моделей (`Product`, `User`, `Purchase`…), справа — строки;
можно фильтровать, редактировать и добавлять записи. Остановить — `Ctrl+C`.

### Подключение из внешнего SQL-клиента (DBeaver, pgAdmin и т.п.)

| Параметр | Значение |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Database | `polka_db` |
| User | `polka` |
| Password | `password` |

---

## Что тестировать

### Покупатель (`buyer@polka.test`)
- `/login` — вход
- `/catalog` — каталог, фильтры по категориям, поиск, сортировка
- `/product/<slug>` — страница продукта: описание, требования, «что входит», покупка, Q&A
  (в вопросе нельзя оставить телефон/email/телеграм — сработает фильтр контактов)
- `/sell` под покупателем — кнопка «Стать разработчиком»: роль меняется на месте,
  без пере-логина, и открывается кабинет разработчика
- `/purchases` — история покупок (бейдж непрочитанных сообщений)
- `/purchases/<id>` — детали покупки: скачивание, инструкция, переписка с разработчиком
  (в чате тоже действует фильтр контактов)
- `/purchases/<id>/download` — страница скачивания: инструктаж по безопасности + согласие;
  для снятого продукта — блок с ⚠ вместо кнопки
- Бейдж сообщений (иконка письма) в шапке — счётчик непрочитанных

### Разработчик (`dev@polka.test`)
- `/dashboard` — баланс, продажи, слоты
- `/dashboard/products` — список своих продуктов
- `/submit` — загрузка нового продукта (мастер: категория → описание → функции →
  установка → медиа → цена)
- `/dashboard/payouts` — запрос вывода средств
- `/dashboard/questions` — ответы на вопросы покупателей по своим продуктам
- `/dashboard/messages` — диалоги с покупателями; `/dashboard/messages/<id>` — тред
- `/sell` — лендинг для разработчиков, калькулятор дохода

### Модератор (`moderator@polka.test`)
- `/admin/queue` — очередь продуктов на проверку
- `/admin/review/<id>` — карточка проверки: скан, авто-оценка, инструкция, находки
  дубликатов (ссылка на оригинал); кнопка «Подтвердить работоспособность»; одобрить / отклонить;
  снятие с публикации и «Информировать покупателей о проблеме безопасности»
- `/admin/products` — все продукты с поиском и фильтром по статусу; быстрое снятие/восстановление

Бейдж «Проверено вручную» после подтверждения виден на странице продукта, в каталоге
и даёт буст в сортировке «Популярные». При одобрении новой версии бейдж снимается.

### Администратор (`admin@polka.test`)
- Всё из списков выше
- `/admin/users`, `/admin/coupons`

### Публичные страницы
- `/` — лендинг (Hero, цифры, популярное, категории, безопасность)
- `/sell` — страница для разработчиков

---

## Автоматические тесты

```powershell
npm run test:e2e          # Playwright e2e (нужен запущенный dev-сервер на :3000)
npx tsx test-zip-bomb.ts  # юнит-тесты защиты от zip-бомб
node test-run.mjs         # браузерный смоук-тест (нужен запущенный dev-сервер)
```

---

## Типовой сценарий «с нуля»

```powershell
docker compose up -d db                  # 1. поднять базу
npx prisma db push                       # 2. накатить схему
npm run db:seed:demo                     # 3. демо-продукты (dev-only)
npx tsx scripts/seed-test-users.ts       # 4. тестовые аккаунты
npm run dev                              # 5. запустить приложение
# отдельный терминал, по желанию:
npm run db:studio                        # визуальный просмотр базы
```
