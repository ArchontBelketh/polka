import Link from "next/link"
import { db } from "@/lib/db"
import { ProductCard } from "@/components/catalog/ProductCard"
import type { Product } from "@/types"

type FeaturedProduct = Pick<Product, "id" | "slug" | "title" | "shortDesc" | "category" | "price" | "rating" | "reviewCount" | "salesCount" | "screenshots" | "techStack"> & { manuallyVerified: boolean }

export async function FeaturedProducts() {
  let products: FeaturedProduct[]
  try {
    products = await db.product.findMany({
      where: { status: "APPROVED" },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take: 3,
      select: {
        id: true, slug: true, title: true, shortDesc: true, category: true, price: true,
        rating: true, reviewCount: true, salesCount: true, screenshots: true,
        techStack: true, manuallyVerified: true,
      },
    })
  } catch {
    console.error("Home: featured products could not be loaded")
    return <p className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground" role="status">Сейчас не удалось загрузить товары. Попробуйте открыть каталог позже.</p>
  }

  if (!products.length) return (
    <div className="rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center">
      <p className="font-medium text-foreground">На полке пока нет опубликованных решений</p>
      <p className="mt-2 text-sm text-muted-foreground">Есть полезный бот, модуль или скрипт? <Link href="/sell" className="text-violet underline-offset-4 hover:underline">Разместите свой код</Link>.</p>
    </div>
  )

  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
}
