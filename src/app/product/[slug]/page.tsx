import { notFound } from "next/navigation"
import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { CATEGORY_LABELS } from "@/types"
import { BuyPanel } from "@/components/product/BuyPanel"
import { ReviewList } from "@/components/product/ReviewList"
import { ReviewForm } from "@/components/product/ReviewForm"
import { ScreenshotSlider } from "@/components/product/ScreenshotSlider"
import { AiReviewOrder } from "@/components/product/AiReviewOrder"
import { QASection } from "@/components/product/QASection"
import { getPresignedDownloadUrl } from "@/lib/s3"
import { Check, Star, FileText, Monitor, Lock } from "lucide-react"
import Link from "next/link"
import { Markdown } from "@/components/ui/Markdown"
import { formatFileSize } from "@/lib/utils"
import { TechBadge } from "@/components/catalog/TechBadge"
import { VerifiedBadge } from "@/components/product/VerifiedBadge"
import type { AiReviewResult } from "@/lib/ai-review/prompt"
import type { Metadata } from "next"

interface ProductPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params
  const product = await db.product.findUnique({
    where: { slug, status: "APPROVED" },
    select: { title: true, shortDesc: true, screenshots: true },
  })
  if (!product) return {}

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"
  const ogImage = product.screenshots[0]
    ? `${appUrl}/api/og?key=${encodeURIComponent(product.screenshots[0])}`
    : `${appUrl}/og-default.svg`

  return {
    title: `${product.title} — ПОЛКА`,
    description: product.shortDesc,
    openGraph: {
      title: product.title,
      description: product.shortDesc,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: product.title,
      description: product.shortDesc,
      images: [ogImage],
    },
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params
  const session = await auth()

  const product = await db.product.findUnique({
    where: { slug },
    include: {
      author: { select: { id: true, name: true, email: true } },
      files: {
        where: { fileType: "SOURCE" },
        select: { fileName: true, fileSize: true, format: true },
        orderBy: { createdAt: "asc" },
      },
    },
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

  // Check if current user has a purchase (to show review form + full install guide)
  const [purchaseRecord, existingAiReview] = await Promise.all([
    session?.user?.id
      ? db.purchase.findFirst({
          where: {
            buyerId: session.user.id,
            productId: product.id,
            status: { in: ["PAID", "DELIVERED"] },
          },
          select: { id: true },
        })
      : null,
    session?.user?.id && !isOwnProduct
      ? db.aiReview.findFirst({
          where: { productId: product.id, requestedBy: session.user.id },
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true, result: true, createdAt: true },
        })
      : null,
  ])

  const hasPurchase = Boolean(purchaseRecord)
  const purchaseId = purchaseRecord?.id ?? null

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: product.title,
    description: product.shortDesc,
    url: `${appUrl}/product/${product.slug}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: (product.price / 100).toFixed(2),
      priceCurrency: "RUB",
      availability: "https://schema.org/InStock",
    },
    aggregateRating:
      product.reviewCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: product.rating.toFixed(1),
            reviewCount: product.reviewCount,
            bestRating: "5",
            worstRating: "1",
          }
        : undefined,
    author: {
      "@type": "Person",
      name: authorName,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
                {product.manuallyVerified && <VerifiedBadge />}
              </div>
              <h1 className="text-2xl font-bold text-foreground">{product.title}</h1>
              <p className="mt-2 text-muted-foreground">{product.shortDesc}</p>
              {product.reviewCount > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{product.rating.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">
                    ({product.reviewCount} {reviewWord(product.reviewCount)})
                  </span>
                </div>
              )}
            </div>

            <ScreenshotSlider urls={screenshotUrls} title={product.title} />

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

            {/* System requirements — public, reduces post-purchase disputes */}
            {product.requirements.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-primary" />
                  Системные требования
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {product.requirements.map((r, i) => (
                    <li key={i} className="rounded-md border border-border bg-muted px-3 py-1.5 text-sm">
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* What's included — the files the buyer receives */}
            {product.files.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Что входит в покупку
                </h2>
                <ul className="space-y-2">
                  {product.files.map((f, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
                    >
                      <span className="font-mono truncate">{f.fileName}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">
                        {f.format} · {formatFileSize(f.fileSize)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Install guide — teaser before purchase, full after */}
            {product.installGuide && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">Установка</h2>
                {hasPurchase ? (
                  <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                    <Markdown content={product.installGuide} />
                    {purchaseId && (
                      <Link
                        href={`/purchases/${purchaseId}`}
                        className="inline-block text-xs text-primary underline-offset-2 hover:underline"
                      >
                        Открыть на странице покупки →
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="relative overflow-hidden rounded-lg border border-border bg-card p-4">
                    <div className="max-h-28 overflow-hidden">
                      <Markdown content={product.installGuide.slice(0, 300)} />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 flex h-24 items-end justify-center bg-gradient-to-t from-card to-transparent pb-3">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Lock className="h-3.5 w-3.5" />
                        Полная инструкция доступна после покупки
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(product.targetAudience || product.techStack.length > 0) && (
              <div className="rounded-lg bg-muted p-4 space-y-3 text-sm">
                {product.targetAudience && (
                  <div>
                    <span className="text-muted-foreground">Целевая аудитория: </span>
                    <span>{product.targetAudience}</span>
                  </div>
                )}
                {product.techStack.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-muted-foreground">Стек технологий:</span>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {product.techStack.map(tag => (
                        <TechBadge key={tag} label={tag} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI Review */}
            {session?.user && !isOwnProduct && (
              <AiReviewOrder
                productId={product.id}
                existingReview={existingAiReview ? {
                  id: existingAiReview.id,
                  status: existingAiReview.status,
                  result: existingAiReview.result as AiReviewResult | null,
                  createdAt: existingAiReview.createdAt.toISOString(),
                } : null}
              />
            )}

            {/* Questions & Answers */}
            <Suspense fallback={<p className="text-sm text-muted-foreground">Загрузка вопросов…</p>}>
              <QASection
                productId={product.id}
                productAuthorId={product.authorId}
                productSlug={product.slug}
              />
            </Suspense>

            {/* Reviews */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Отзывы</h2>
              <Suspense fallback={<p className="text-sm text-muted-foreground">Загрузка…</p>}>
                <ReviewList productId={product.id} />
              </Suspense>

              {hasPurchase && !isOwnProduct && (
                <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Оставить отзыв</h3>
                  <ReviewForm productId={product.id} />
                </div>
              )}
            </section>
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
    </>
  )
}

function reviewWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return "отзывов"
  if (mod10 === 1) return "отзыв"
  if (mod10 >= 2 && mod10 <= 4) return "отзыва"
  return "отзывов"
}
