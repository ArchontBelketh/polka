import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/utils"
import { CATEGORY_LABELS } from "@/types"
import { Download, Heart, ShoppingBag } from "lucide-react"
import { ProductCard } from "@/components/catalog/ProductCard"
import { cn } from "@/lib/utils"

export const metadata = { title: "Кабинет покупателя" }

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Ожидает оплаты",
  PAID: "Оплачено",
  DELIVERED: "Доставлено",
  REFUNDED: "Возврат",
  DISPUTED: "Спор",
}
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  PAID: "default",
  DELIVERED: "secondary",
  REFUNDED: "destructive",
  DISPUTED: "destructive",
}

interface PageProps {
  searchParams: Promise<{ paid?: string; tab?: string }>
}

export default async function PurchasesPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { paid, tab = "purchases" } = await searchParams
  const activeTab = tab === "wishlist" ? "wishlist" : "purchases"

  const [purchases, wishlistItems] = await Promise.all([
    db.purchase.findMany({
      where: { buyerId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          select: {
            id: true,
            slug: true,
            title: true,
            category: true,
            price: true,
            screenshots: true,
          },
        },
      },
    }),
    db.wishlist.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          select: {
            id: true,
            slug: true,
            title: true,
            shortDesc: true,
            category: true,
            price: true,
            rating: true,
            reviewCount: true,
            salesCount: true,
            screenshots: true,
            techStack: true,
            status: true,
            manuallyVerified: true,
          },
        },
      },
    }),
  ])

  const purchasedIds = new Set(purchases.map((p) => p.product.id))

  // Unread message counts per purchase (messages from the developer)
  const unreadRows = await db.purchaseMessage.groupBy({
    by: ["purchaseId"],
    where: {
      senderId: { not: session.user.id },
      isRead: false,
      purchaseId: { in: purchases.map((p) => p.id) },
    },
    _count: { _all: true },
  })
  const unreadMap = new Map(unreadRows.map((r) => [r.purchaseId, r._count._all]))

  function tabUrl(t: string) {
    const sp = new URLSearchParams()
    sp.set("tab", t)
    return `/purchases?${sp.toString()}`
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">Кабинет покупателя</h1>
        <div className="flex gap-3 text-sm text-muted-foreground shrink-0">
          <span className="flex items-center gap-1.5">
            <ShoppingBag className="h-4 w-4" />
            {purchases.length} покупок
          </span>
          <span className="flex items-center gap-1.5">
            <Heart className="h-4 w-4" />
            {wishlistItems.length} в избранном
          </span>
        </div>
      </div>

      {/* Success banner */}
      {paid && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          ✓ Оплата прошла успешно. Файл доступен для скачивания.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <Link
          href={tabUrl("purchases")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "purchases"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Покупки
          {purchases.length > 0 && (
            <span className="ml-1.5 text-xs text-muted-foreground">({purchases.length})</span>
          )}
        </Link>
        <Link
          href={tabUrl("wishlist")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5",
            activeTab === "wishlist"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Heart className="h-3.5 w-3.5" />
          Понравившееся
          {wishlistItems.length > 0 && (
            <span className="text-xs text-muted-foreground">({wishlistItems.length})</span>
          )}
        </Link>
      </div>

      {/* Purchases tab */}
      {activeTab === "purchases" && (
        purchases.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <p className="text-muted-foreground">У вас пока нет покупок.</p>
            <Button asChild>
              <Link href="/catalog">Перейти в каталог</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {purchases.map((p) => {
              const canDownload = p.status === "PAID" || p.status === "DELIVERED"
              return (
                <div
                  key={p.id}
                  className="rounded-lg border border-border bg-card p-4 flex items-center gap-4"
                >
                  {p.product.screenshots[0] && (
                    <Link href={`/product/${p.product.slug}`} className="shrink-0 hidden sm:block">
                      <img
                        src={p.product.screenshots[0]}
                        alt=""
                        className="h-14 w-20 rounded object-cover"
                      />
                    </Link>
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/product/${p.product.slug}`}
                        className="font-medium hover:underline truncate"
                      >
                        {p.product.title}
                      </Link>
                      <Badge variant={STATUS_VARIANTS[p.status] ?? "outline"} className="text-xs">
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                      {(unreadMap.get(p.id) ?? 0) > 0 && (
                        <Badge variant="default" className="text-xs">
                          {unreadMap.get(p.id)} новых
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {CATEGORY_LABELS[p.product.category as keyof typeof CATEGORY_LABELS]} ·{" "}
                      {formatPrice(p.amount)} ·{" "}
                      {new Date(p.createdAt).toLocaleDateString("ru-RU")}
                      {p.escrowUntil && p.status === "PAID" && (
                        <> · Возврат до {new Date(p.escrowUntil).toLocaleDateString("ru-RU")}</>
                      )}
                    </p>
                    {canDownload && (
                      <Link
                        href={`/purchases/${p.id}`}
                        className="inline-block text-xs text-primary underline-offset-2 hover:underline"
                      >
                        Инструкция и детали →
                      </Link>
                    )}
                  </div>

                  {canDownload && (
                    <Button variant="outline" size="sm" asChild className="shrink-0">
                      <Link href={`/purchases/${p.id}/download`}>
                        <Download className="h-4 w-4 mr-1" />
                        Скачать
                      </Link>
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Wishlist tab */}
      {activeTab === "wishlist" && (
        wishlistItems.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <Heart className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">В избранном пусто.</p>
            <Button asChild variant="outline">
              <Link href="/catalog">Посмотреть каталог</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {wishlistItems.some((w) => purchasedIds.has(w.product.id)) && (
              <p className="text-sm text-muted-foreground">
                Продукты с пометкой «Куплено» уже есть в ваших покупках.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {wishlistItems.map((w) => (
                <div key={w.id} className="relative">
                  {purchasedIds.has(w.product.id) && (
                    <div className="absolute top-2 left-2 z-10">
                      <Badge variant="secondary" className="text-xs">Куплено</Badge>
                    </div>
                  )}
                  {w.product.status !== "APPROVED" && (
                    <div className="absolute inset-0 rounded-lg bg-background/60 z-10 flex items-center justify-center">
                      <Badge variant="outline" className="text-xs">Недоступен</Badge>
                    </div>
                  )}
                  <ProductCard
                    product={w.product}
                    isWishlisted={true}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}
