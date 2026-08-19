import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatPrice } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { BuyButton } from "./BuyButton"
import { RequestPurchaseButton } from "./RequestPurchaseButton"
import Link from "next/link"
import { Download, Star, ShoppingBag, Clock } from "lucide-react"

interface BuyPanelProps {
  productId: string
  price: number
  rating: number
  reviewCount: number
  salesCount: number
  authorName: string
  demoUrl?: string | null
  isOwnProduct?: boolean
  saleModel?: string | null
  developerPaymentInfo?: string | null
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
  saleModel,
  developerPaymentInfo,
}: BuyPanelProps) {
  const session = await auth()
  const isListing = saleModel === "LISTING_FEE"

  let purchase: { id: string; status: string } | null = null
  if (session?.user?.id && !isOwnProduct) {
    purchase = await db.purchase.findFirst({
      where: {
        buyerId: session.user.id,
        productId,
        status: { in: ["AWAITING", "PAID", "DELIVERED"] },
      },
      select: { id: true, status: true },
    })
  }

  const delivered = purchase && (purchase.status === "PAID" || purchase.status === "DELIVERED")
  const awaiting = purchase?.status === "AWAITING"

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

      {/* Action area */}
      {isOwnProduct ? (
        <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground text-center">
          Это ваш продукт
        </div>
      ) : delivered ? (
        <Button className="w-full" size="lg" asChild>
          <Link href={`/purchases/${purchase!.id}/download`}>
            <Download className="h-4 w-4 mr-2" />
            Скачать
          </Link>
        </Button>
      ) : awaiting ? (
        <div className="space-y-2">
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300 flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0" />
            Заявка отправлена — ожидает подтверждения оплаты разработчиком.
          </div>
          <Button variant="outline" className="w-full" asChild>
            <Link href={`/purchases/${purchase!.id}`}>Открыть покупку</Link>
          </Button>
        </div>
      ) : isListing ? (
        <div className="space-y-3">
          <div className="rounded-md border border-border bg-muted/40 p-3 space-y-1.5">
            <p className="text-sm font-medium">Как оплатить</p>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
              {developerPaymentInfo || "Разработчик не указал реквизиты — обратитесь к нему через вопросы."}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Оплата идёт <b>напрямую разработчику</b>, площадка в расчётах не участвует. После оплаты
            нажмите кнопку ниже — разработчик подтвердит получение и откроет скачивание.
          </p>
          {session?.user ? (
            developerPaymentInfo ? (
              <RequestPurchaseButton productId={productId} />
            ) : null
          ) : (
            <Button className="w-full" size="lg" asChild>
              <Link href={`/login?callbackUrl=/product/${productId}`}>Войти для покупки</Link>
            </Button>
          )}
        </div>
      ) : session?.user ? (
        <BuyButton productId={productId} price={price} />
      ) : (
        <Button className="w-full" size="lg" asChild>
          <Link href={`/login?callbackUrl=/product/${productId}`}>Войти для покупки</Link>
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
        {isListing ? (
          <li>✓ Оплата напрямую разработчику</li>
        ) : (
          <li>✓ Оплата через защищённую форму ЮKassa</li>
        )}
      </ul>
    </div>
  )
}
