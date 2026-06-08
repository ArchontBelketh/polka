import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { CATEGORY_LABELS } from "@/types"
import { BuyPanel } from "@/components/product/BuyPanel"
import { getPresignedDownloadUrl } from "@/lib/s3"
import { Check } from "lucide-react"

interface ProductPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { slug } = await params
  const product = await db.product.findUnique({
    where: { slug, status: "APPROVED" },
    select: { title: true, shortDesc: true },
  })
  if (!product) return {}
  return { title: `${product.title} — ПОЛКА`, description: product.shortDesc }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params
  const session = await auth()

  const product = await db.product.findUnique({
    where: { slug },
    include: { author: { select: { id: true, name: true, email: true } } },
  })

  if (!product || product.status !== "APPROVED") notFound()

  const screenshotUrls: string[] = []
  for (const key of product.screenshots.slice(0, 5)) {
    try {
      screenshotUrls.push(await getPresignedDownloadUrl(key))
    } catch {
      // skip if S3 not configured
    }
  }

  const isOwnProduct = session?.user?.id === product.authorId
  const authorName = product.author.name ?? product.author.email ?? "Разработчик"

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">
                {CATEGORY_LABELS[product.category as keyof typeof CATEGORY_LABELS]}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {product.license === "personal" ? "Личная лицензия" : product.license}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold text-foreground">{product.title}</h1>
            <p className="mt-2 text-muted-foreground">{product.shortDesc}</p>
          </div>

          {screenshotUrls.length > 0 && (
            <div className="rounded-lg overflow-hidden bg-muted aspect-video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screenshotUrls[0]}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Описание</h2>
            <div className="text-muted-foreground whitespace-pre-line text-sm leading-relaxed">
              {product.fullDesc}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Возможности</h2>
            <ul className="space-y-2">
              {product.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {(product.targetAudience || product.techStack) && (
            <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
              {product.targetAudience && (
                <div>
                  <span className="text-muted-foreground">Целевая аудитория: </span>
                  <span>{product.targetAudience}</span>
                </div>
              )}
              {product.techStack && (
                <div>
                  <span className="text-muted-foreground">Стек: </span>
                  <span>{product.techStack}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Buy panel sidebar */}
        <div>
          <BuyPanel
            productId={product.id}
            price={product.price}
            rating={product.rating}
            reviewCount={product.reviewCount}
            salesCount={product.salesCount}
            authorName={authorName}
            demoUrl={product.demoUrl}
            isOwnProduct={isOwnProduct}
          />
        </div>
      </div>
    </div>
  )
}
