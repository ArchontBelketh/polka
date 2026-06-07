import { Suspense } from "react"
import { CategoryFilter } from "@/components/catalog/CategoryFilter"
import { ProductCard } from "@/components/catalog/ProductCard"
import type { Category, Product } from "@/types"

// Моковые данные — заменить на реальные из БД в неделю 3
const MOCK_PRODUCTS: Pick<
  Product,
  "id" | "slug" | "title" | "shortDesc" | "category" | "price" | "rating" | "reviewCount" | "salesCount" | "screenshots" | "status"
>[] = [
  {
    id: "1", slug: "telegram-bot-zapis-klientov",
    title: "Telegram-бот записи клиентов",
    shortDesc: "Автоматизирует запись клиентов через Telegram. Поддержка расписания, напоминаний и оплаты.",
    category: "TELEGRAM", price: 490000, rating: 4.8, reviewCount: 24, salesCount: 87, screenshots: [], status: "APPROVED",
  },
  {
    id: "2", slug: "parser-avito-nedvizhimost",
    title: "Парсер Авито — недвижимость",
    shortDesc: "Собирает объявления с Авито по заданным фильтрам. Выгрузка в Excel, обновление по расписанию.",
    category: "PARSER", price: 290000, rating: 4.5, reviewCount: 11, salesCount: 43, screenshots: [], status: "APPROVED",
  },
  {
    id: "3", slug: "excel-uchet-sklada",
    title: "Excel: учёт склада",
    shortDesc: "Полноценная система учёта товаров на складе в Excel. Приход, расход, остатки, отчёты.",
    category: "EXCEL", price: 190000, rating: 4.9, reviewCount: 36, salesCount: 152, screenshots: [], status: "APPROVED",
  },
  {
    id: "4", slug: "avtomatizatsiya-1c-zayavki",
    title: "Автоматизация 1С: обработка заявок",
    shortDesc: "Внешняя обработка для 1С: Предприятие 8. Автоматически создаёт заказы из входящих заявок по email.",
    category: "AUTOMATION", price: 790000, rating: 4.7, reviewCount: 8, salesCount: 19, screenshots: [], status: "APPROVED",
  },
  {
    id: "5", slug: "telegram-bot-magazin",
    title: "Telegram-магазин с оплатой",
    shortDesc: "Готовый интернет-магазин в Telegram с каталогом, корзиной и оплатой через ЮKassa.",
    category: "TELEGRAM", price: 890000, rating: 4.6, reviewCount: 17, salesCount: 34, screenshots: [], status: "APPROVED",
  },
  {
    id: "6", slug: "parser-wildberries-tseny",
    title: "Мониторинг цен Wildberries",
    shortDesc: "Отслеживает изменения цен конкурентов на Wildberries. Уведомления в Telegram при снижении.",
    category: "PARSER", price: 350000, rating: 4.4, reviewCount: 9, salesCount: 28, screenshots: [], status: "APPROVED",
  },
]

interface CatalogPageProps {
  searchParams: Promise<{ category?: string; q?: string; page?: string }>
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const { category, q } = await searchParams

  const filtered = MOCK_PRODUCTS.filter((p) => {
    if (category && p.category !== category) return false
    if (q && !p.title.toLowerCase().includes(q.toLowerCase()) &&
        !p.shortDesc.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Каталог</h1>
        <span className="text-sm text-muted-foreground">
          {filtered.length} {plural(filtered.length, "продукт", "продукта", "продуктов")}
        </span>
      </div>

      <Suspense>
        <CategoryFilter />
      </Suspense>

      {filtered.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          Ничего не найдено
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}
