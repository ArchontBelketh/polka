import Link from "next/link"
import { Star, ShoppingBag } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { CATEGORY_LABELS, type Category, type Product } from "@/types"
import { WishlistButton } from "@/components/catalog/WishlistButton"
import { VerifiedBadge } from "@/components/product/VerifiedBadge"

interface ProductCardProps {
  product: Pick<
    Product,
    "id" | "slug" | "title" | "shortDesc" | "category" | "price" | "rating" | "reviewCount" | "salesCount" | "screenshots" | "techStack"
  > & { manuallyVerified?: boolean }
  isWishlisted?: boolean
}

// Акцент карточки по категории (бирюза/фиолет) — детерминированно.
const ACCENT: Record<Category, "cyan" | "violet"> = {
  TELEGRAM: "violet",
  PARSER: "cyan",
  EXCEL: "violet",
  AUTOMATION: "cyan",
  WEB: "violet",
}
const CHIP = {
  cyan: "text-cyan bg-cyan/10 border-cyan/25",
  violet: "text-violet bg-violet/10 border-violet/25",
} as const
const TINT = {
  cyan: "from-cyan/10",
  violet: "from-violet/10",
} as const
const CODE = {
  cyan: "text-cyan",
  violet: "text-violet",
} as const

export function ProductCard({ product, isWishlisted = false }: ProductCardProps) {
  const accent = ACCENT[product.category]

  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 hover:-translate-y-1 hover:border-deep/40 hover:shadow-[0_18px_44px_-14px_rgba(108,75,245,0.4)]">
        {/* media */}
        <div className="relative h-40 overflow-hidden border-b border-border bg-[#0c0b16]">
          <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.02)_0_1px,transparent_1px_12px)]" />
          <div className={`absolute inset-0 bg-gradient-to-tr ${TINT[accent]} via-transparent to-transparent`} />
          <div className="absolute right-3.5 top-3 z-10">
            <WishlistButton productId={product.id} initialSaved={isWishlisted} />
          </div>
          {product.screenshots[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.screenshots[0]}
              alt={product.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="relative flex h-full flex-col items-center justify-center gap-2">
              <span className={`font-mono text-3xl font-extrabold leading-none opacity-90 ${CODE[accent]}`}>&gt;_</span>
              <span className="font-mono text-[11px] tracking-wider text-muted-foreground">{CATEGORY_LABELS[product.category]}</span>
            </div>
          )}
        </div>

        {/* body */}
        <div className="flex flex-1 flex-col p-5">
          <div className="mb-2.5 flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-foreground">{product.title}</h3>
            <span className={`shrink-0 rounded-md border px-2 py-1 font-mono text-[10.5px] ${CHIP[accent]}`}>
              {CATEGORY_LABELS[product.category]}
            </span>
          </div>

          {product.manuallyVerified && <VerifiedBadge compact />}

          <p className="mb-3.5 line-clamp-2 min-h-10 text-[13.5px] leading-relaxed text-muted-foreground">{product.shortDesc}</p>

          {product.techStack.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {product.techStack.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
                  {tag}
                </span>
              ))}
              {product.techStack.length > 3 && (
                <span className="inline-flex items-center font-mono text-[10.5px] text-muted-foreground">+{product.techStack.length - 3}</span>
              )}
            </div>
          )}

          <div className="mt-auto flex items-center justify-between border-t border-border pt-3.5">
            <span className="text-lg font-extrabold text-foreground">{formatPrice(product.price)}</span>
            <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
              {product.reviewCount > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-cyan text-cyan" />
                  {product.rating.toFixed(1)}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5" />
                {product.salesCount}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
