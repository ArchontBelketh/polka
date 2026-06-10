import Link from "next/link"
import { ProductCard } from "@/components/catalog/ProductCard"
import type { Product } from "@/types"

type FeaturedProduct = Pick<
  Product,
  "id" | "slug" | "title" | "shortDesc" | "category" | "price" | "rating" | "reviewCount" | "salesCount" | "screenshots" | "techStack" | "manuallyVerified"
>

interface FeaturedRowProps {
  products: FeaturedProduct[]
}

export function FeaturedRow({ products }: FeaturedRowProps) {
  if (products.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-4 py-16">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Популярное</h2>
          <p className="mt-1 text-muted-foreground">Продукты, которые покупают чаще всего</p>
        </div>
        <Link href="/catalog?sort=popular" className="text-sm text-primary underline-offset-2 hover:underline">
          Весь каталог →
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}
