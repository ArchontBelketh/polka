# Ручное тестирование ПОЛКА

## Тестовые аккаунты

| Email | Роль | Пароль |
|---|---|---|
| `admin@polka.test` | ADMIN | `password123` |
| `dev@polka.test` | DEVELOPER | `password123` |
| `buyer@polka.test` | BUYER | `password123` |
| `moderator@polka.test` | MODERATOR | `password123` |

---

## Запуск

Выполнять команды по порядку из папки `c:\portfolio\polka`.

### 1. Сгенерировать клиент Prisma (один раз после изменений схемы)

```powershell
npx prisma generate
```

### 2. Применить миграции БД (один раз после изменений схемы)

```powershell
npx prisma migrate dev
```

### 3. Засеять тестовые аккаунты (если не созданы)

```powershell
$env:DATABASE_URL="postgres://postgres:postgres@localhost:51218/template1?sslmode=disable"; npx tsx scripts/seed-test-users.ts
```

### 4. Запустить дев-сервер

```powershell
npm run dev
```

Сервер доступен на **http://localhost:3000**

---

## Остановка

### Остановить дев-сервер

Нажать `Ctrl+C` в терминале, где запущен `npm run dev`.

Или, если сервер запущен в фоне, найти и убить процесс:

```powershell
# Найти процесс на порту 3000
netstat -ano | findstr :3000

# Убить по PID (заменить XXXXX на реальный PID из вывода выше)
taskkill /PID XXXXX /F
```

---

## Что тестировать

### Покупатель (`buyer@polka.test`)
- `/login` — вход
- `/catalog` — каталог продуктов, фильтры по категориям, поиск
- `/product/<slug>` — страница продукта, кнопка «Купить»
- `/purchases` — история покупок

### Разработчик (`dev@polka.test`)
- `/dashboard` — баланс, продажи
- `/dashboard/products` — список своих продуктов
- `/dashboard/products/new` — загрузка нового продукта
- `/dashboard/payouts` — запрос вывода средств

### Модератор (`moderator@polka.test`)
- `/admin/queue` — очередь продуктов на проверку
- `/admin/review/<id>` — одобрить или отклонить продукт

### Администратор (`admin@polka.test`)
- Всё из списков выше

---

## Просмотр базы данных

```powershell
npx prisma studio
```

Откроется веб-интерфейс на **http://localhost:5555**

Для выхода — `Ctrl+C` в терминале.
