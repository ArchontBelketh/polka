import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/utils"
import { CATEGORY_LABELS } from "@/types"
import { Download } from "lucide-react"

export const metadata = { title: "Мои покупки — ПОЛКА" }

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
  searchParams: Promise<{ paid?: string }>
}

export default async function PurchasesPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { paid } = await searchParams

  const purchases = await db.purchase.findMany({
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
  })

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Мои покупки</h1>

      {paid && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          ✓ Оплата прошла успешно. Файл доступен для скачивания.
        </div>
      )}

      {purchases.length === 0 ? (
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
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/product/${p.product.slug}`}
                      className="font-medium hover:underline truncate"
                    >
                      {p.product.title}
                    </Link>
                    <Badge variant={STATUS_VARIANTS[p.status] ?? "outline"}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {CATEGORY_LABELS[p.product.category as keyof typeof CATEGORY_LABELS]} ·{" "}
                    {formatPrice(p.amount)} ·{" "}
                    {new Date(p.createdAt).toLocaleDateString("ru-RU")}
                    {p.escrowUntil && p.status === "PAID" && (
                      <> · Возврат до {new Date(p.escrowUntil).toLocaleDateString("ru-RU")}</>
                    )}
                  </p>
                </div>

                {canDownload && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/api/download/${p.id}`}>
                      <Download className="h-4 w-4 mr-1" />
                      Скачать
                    </Link>
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
