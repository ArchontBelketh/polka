# Ручное тестирование ПОЛКА

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
npm run db:seed                        # 6 демо-продуктов + демо-автор
npx tsx scripts/seed-test-users.ts     # 4 тестовых аккаунта (см. таблицу выше)
```

---

## Запуск приложения

```powershell
npm run dev
```

Приложение доступно на **http://localhost:3000**

Остановить — `Ctrl+C` в терминале. Если сервер запущен в фоне и порт занят:

```powershell
netstat -ano | findstr :3000          # найти PID
taskkill /PID <PID> /F                # убить процесс
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
- `/purchases` — история покупок (бейдж непрочитанных сообщений)
- `/purchases/<id>` — детали покупки: скачивание, инструкция, переписка с разработчиком,
  кнопка «Открыть спор»
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
- `/admin/review/<id>` — карточка проверки: скан, авто-оценка, инструкция; одобрить / отклонить
- `/admin/disputes` — споры: переписка покупатель↔разработчик, возврат / отклонение спора

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
npm run db:seed                          # 3. демо-продукты
npx tsx scripts/seed-test-users.ts       # 4. тестовые аккаунты
npm run dev                              # 5. запустить приложение
# отдельный терминал, по желанию:
npm run db:studio                        # визуальный просмотр базы
```
