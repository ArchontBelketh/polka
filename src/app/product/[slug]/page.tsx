import { notFound } from "next/navigation"
import { Star, ShoppingBag, ExternalLink, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/utils"
import { CATEGORY_LABELS, type Product } from "@/types"

// Моковые данные — заменить на db.product.findUnique в неделю 3
const MOCK_PRODUCTS: (Pick<Product, "slug" | "title" | "shortDesc" | "fullDesc" | "category" | "price" | "rating" | "reviewCount" | "salesCount" | "screenshots" | "features" | "demoUrl" | "targetAudience" | "techStack" | "license"> & { authorName: string })[] = [
  {
    slug: "telegram-bot-zapis-klientov",
    title: "Telegram-бот записи клиентов",
    shortDesc: "Автоматизирует запись клиентов через Telegram.",
    fullDesc: `Готовый Telegram-бот для автоматизации записи клиентов. Подходит для салонов красоты, медицинских центров, фитнес-студий и любого сервисного бизнеса.

**Что умеет бот:**
- Показывает доступные слоты в удобном интерфейсе
- Отправляет напоминания за 24 часа и 1 час до записи
- Принимает оплату через ЮKassa прямо в Telegram
- Ведёт базу клиентов и историю посещений
- Уведомляет администратора о новых записях

**Технические детали:**
Бот написан на Python (aiogram 3.x). Данные хранятся в PostgreSQL. Поставляется с инструкцией по деплою на VPS.`,
    category: "TELEGRAM",
    price: 490000,
    rating: 4.8,
    reviewCount: 24,
    salesCount: 87,
    screenshots: [],
    features: [
      "Онлайн-запись 24/7 без участия администратора",
      "Встроенная оплата через ЮKassa",
      "Автоматические напоминания клиентам",
      "Панель управления для администратора",
      "Экспорт расписания в Excel",
    ],
    demoUrl: null,
    targetAudience: "Салоны красоты, медицинские центры, фитнес-студии",
    techStack: "Python, aiogram 3, PostgreSQL, ЮKassa API",
    license: "personal",
    authorName: "Алексей Смирнов",
  },
]

interface ProductPageProps {
  params: Promise<{ slug: string }>
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params
  const product = MOCK_PRODUCTS.find((p) => p.slug === slug)

  if (!product) notFound()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Основная информация */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">{CATEGORY_LABELS[product.category]}</Badge>
              <Badge variant="outline" className="text-xs">
                {product.license === "personal" ? "Личная лицензия" : product.license}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold text-foreground">{product.title}</h1>
            <p className="mt-2 text-muted-foreground">{product.shortDesc}</p>
          </div>

          {/* Скриншоты */}
          {product.screenshots.length > 0 && (
            <div className="rounded-lg overflow-hidden bg-muted aspect-video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={product.screenshots[0]} alt={product.title} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Описание */}
          <div className="prose prose-invert max-w-none">
            <h2 className="text-lg font-semibold text-foreground mb-3">Описание</h2>
            <div className="text-muted-foreground whitespace-pre-line text-sm leading-relaxed">
              {product.fullDesc}
            </div>
          </div>

          {/* Возможности */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Возможности</h2>
            <ul className="space-y-2">
              {product.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Технические детали */}
          {(product.targetAudience || product.techStack) && (
            <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
              {product.targetAudience && (
                <div>
                  <span className="text-muted-foreground">Целевая аудитория: </span>
                  <span className="text-foreground">{product.targetAudience}</span>
                </div>
              )}
              {product.techStack && (
                <div>
                  <span className="text-muted-foreground">Стек: </span>
                  <span className="text-foreground">{product.techStack}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Боковая панель покупки */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5 space-y-4 sticky top-20">
            <div className="text-3xl font-bold text-foreground">
              {formatPrice(product.price)}
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {product.reviewCount > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  {product.rating.toFixed(1)} ({product.reviewCount})
                </span>
              )}
              <span className="flex items-center gap-1">
                <ShoppingBag className="h-4 w-4" />
                {product.salesCount} продаж
              </span>
            </div>

            {/* TODO: BuyPanel — реализуется в неделю 3 */}
            <Button className="w-full" size="lg">
              Купить
            </Button>

            {product.demoUrl && (
              <Button variant="outline" className="w-full" asChild>
                <a href={product.demoUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Демо
                </a>
              </Button>
            )}

            <p className="text-xs text-muted-foreground text-center">
              Автор: {product.authorName}
            </p>

            <ul className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
              <li>✓ Мгновенная доставка после оплаты</li>
              <li>✓ 7 дней на возврат</li>
              <li>✓ Код проверен модератором</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
