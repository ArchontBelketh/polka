import Link from "next/link"
import { ProductCard } from "@/components/catalog/ProductCard"
import { Kicker, ArrowRight } from "./SectionHead"
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
    <section className="mx-auto max-w-7xl px-4 pt-4">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <Kicker>{"// топ продаж"}</Kicker>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground">Популярное</h2>
          <p className="mt-2 text-muted-foreground">Продукты, которые покупают чаще всего</p>
        </div>
        <Link href="/catalog?sort=popular" className="inline-flex items-center gap-1.5 font-semibold text-violet transition-colors hover:text-violet/80">
          Весь каталог
          <ArrowRight />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}
