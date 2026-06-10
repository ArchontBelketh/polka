import Link from "next/link"
import { Star, ShoppingBag } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { formatPrice } from "@/lib/utils"
import { CATEGORY_LABELS, type Product } from "@/types"
import { WishlistButton } from "@/components/catalog/WishlistButton"
import { TechBadge } from "@/components/catalog/TechBadge"
import { VerifiedBadge } from "@/components/product/VerifiedBadge"

interface ProductCardProps {
  product: Pick<
    Product,
    "id" | "slug" | "title" | "shortDesc" | "category" | "price" | "rating" | "reviewCount" | "salesCount" | "screenshots" | "techStack"
  > & { manuallyVerified?: boolean }
  isWishlisted?: boolean
}

export function ProductCard({ product, isWishlisted = false }: ProductCardProps) {
  return (
    <Link href={`/product/${product.slug}`}>
      <Card className="group h-full bg-card border-border hover:border-primary/50 transition-colors cursor-pointer">
        <div className="relative aspect-video bg-muted rounded-t-lg overflow-hidden">
          <div className="absolute top-2 right-2 z-10">
            <WishlistButton productId={product.id} initialSaved={isWishlisted} />
          </div>
          {product.screenshots[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.screenshots[0]}
              alt={product.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
              Нет скриншота
            </div>
          )}
          </div>

        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-foreground line-clamp-2 text-sm leading-snug">
              {product.title}
            </h3>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {CATEGORY_LABELS[product.category]}
            </Badge>
          </div>

          {product.manuallyVerified && <VerifiedBadge compact />}

          <p className="text-xs text-muted-foreground line-clamp-2">
            {product.shortDesc}
          </p>

          {product.techStack.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {product.techStack.slice(0, 3).map(tag => (
                <TechBadge key={tag} label={tag} />
              ))}
              {product.techStack.length > 3 && (
                <span className="inline-flex items-center text-[10px] text-muted-foreground">
                  +{product.techStack.length - 3}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="font-semibold text-foreground">
              {formatPrice(product.price)}
            </span>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {product.reviewCount > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {product.rating.toFixed(1)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <ShoppingBag className="h-3 w-3" />
                {product.salesCount}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
