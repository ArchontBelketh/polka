import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatPrice } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { BuyButton } from "./BuyButton"
import Link from "next/link"
import { Download, Star, ShoppingBag } from "lucide-react"

interface BuyPanelProps {
  productId: string
  price: number
  rating: number
  reviewCount: number
  salesCount: number
  authorName: string
  demoUrl?: string | null
  isOwnProduct?: boolean
}

export async function BuyPanel({
  productId,
  price,
  rating,
  reviewCount,
  salesCount,
  authorName,
  demoUrl,
  isOwnProduct = false,
}: BuyPanelProps) {
  const session = await auth()

  let purchaseId: string | null = null
  if (session?.user?.id && !isOwnProduct) {
    const purchase = await db.purchase.findFirst({
      where: {
        buyerId: session.user.id,
        productId,
        status: { in: ["PAID", "DELIVERED"] },
      },
      select: { id: true },
    })
    purchaseId = purchase?.id ?? null
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4 sticky top-20">
      <div className="text-3xl font-bold text-foreground">{formatPrice(price)}</div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        {reviewCount > 0 && (
          <span className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            {rating.toFixed(1)} ({reviewCount})
          </span>
        )}
        <span className="flex items-center gap-1">
          <ShoppingBag className="h-4 w-4" />
          {salesCount} продаж
        </span>
      </div>

      {isOwnProduct ? (
        <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground text-center">
          Это ваш продукт
        </div>
      ) : purchaseId ? (
        <Button className="w-full" size="lg" asChild>
          <Link href={`/api/download/${purchaseId}`}>
            <Download className="h-4 w-4 mr-2" />
            Скачать
          </Link>
        </Button>
      ) : session?.user ? (
        <BuyButton productId={productId} price={price} />
      ) : (
        <Button className="w-full" size="lg" asChild>
          <Link href={`/login?callbackUrl=/product/${productId}`}>
            Войти для покупки
          </Link>
        </Button>
      )}

      {demoUrl && (
        <Button variant="outline" className="w-full" asChild>
          <a href={demoUrl} target="_blank" rel="noopener noreferrer">
            Демо
          </a>
        </Button>
      )}

      <p className="text-xs text-muted-foreground text-center">Автор: {authorName}</p>

      <ul className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
        <li>✓ Мгновенная доставка после оплаты</li>
        <li>✓ Код проверен модератором</li>
        <li>✓ Оплата через защищённую форму ЮKassa</li>
      </ul>
    </div>
  )
}
