import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatPrice } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { RequestPurchaseButton } from "./RequestPurchaseButton"
import Link from "next/link"
import { Download, Star, ShoppingBag, Clock, ExternalLink } from "lucide-react"

interface BuyPanelProps {
  productId: string
  price: number
  rating: number
  reviewCount: number
  salesCount: number
  authorName: string
  authorId: string
  authorPaymentLink?: string | null
  demoUrl?: string | null
  isOwnProduct?: boolean
  developerPaymentInfo?: string | null
}

export async function BuyPanel({
  productId,
  price,
  rating,
  reviewCount,
  salesCount,
  authorName,
  authorId,
  authorPaymentLink,
  demoUrl,
  isOwnProduct = false,
  developerPaymentInfo,
}: BuyPanelProps) {
  const session = await auth()

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
  const payIsLink = !!authorPaymentLink && /^https?:\/\//i.test(authorPaymentLink)

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

      {/* Action area — прямая оплата автору */}
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
            Заявка отправлена — ожидает подтверждения оплаты автором.
          </div>
          <Button variant="outline" className="w-full" asChild>
            <Link href={`/purchases/${purchase!.id}`}>Открыть покупку</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
            <p className="text-sm font-medium">Оплата автору напрямую</p>
            {authorPaymentLink ? (
              payIsLink ? (
                <a
                  href={authorPaymentLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline break-all"
                >
                  Перейти к оплате ({formatPrice(price)})
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
              ) : (
                <p className="text-sm whitespace-pre-wrap break-all text-foreground">{authorPaymentLink}</p>
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                Автор не указал ссылку для оплаты — задайте вопрос через раздел вопросов.
              </p>
            )}
            {developerPaymentInfo && (
              <p className="text-xs whitespace-pre-wrap text-muted-foreground">{developerPaymentInfo}</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Оплата идёт <b>напрямую автору</b>, ПОЛКА оплату за товары не принимает. После оплаты
            нажмите «Я оплатил» — автор подтвердит получение и откроет скачивание.
          </p>
          {session?.user ? (
            authorPaymentLink ? <RequestPurchaseButton productId={productId} /> : null
          ) : (
            <Button className="w-full" size="lg" asChild>
              <Link href={`/login?callbackUrl=/product/${productId}`}>Войти для покупки</Link>
            </Button>
          )}
        </div>
      )}

      {demoUrl && (
        <Button variant="outline" className="w-full" asChild>
          <a href={demoUrl} target="_blank" rel="noopener noreferrer">
            Демо
          </a>
        </Button>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Автор:{" "}
        <Link href={`/developer/${authorId}`} className="text-primary hover:underline underline-offset-4">
          {authorName}
        </Link>
      </p>

      <ul className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
        <li>✓ Доступ после подтверждения оплаты автором</li>
        <li>✓ Код проверен модератором</li>
        <li>✓ Оплата напрямую автору</li>
      </ul>
    </div>
  )
}
