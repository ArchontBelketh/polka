import type { Metadata } from "next"
import { db } from "@/lib/db"
import { Hero } from "@/components/landing/Hero"
import { TrustBar } from "@/components/landing/TrustBar"
import { HowItWorks } from "@/components/landing/HowItWorks"
import { SafetyBlock } from "@/components/landing/SafetyBlock"
import { FeaturedRow } from "@/components/landing/FeaturedRow"
import { CategoryGrid } from "@/components/landing/CategoryGrid"
import { DeveloperCTA } from "@/components/landing/DeveloperCTA"
import type { Category } from "@/types"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://polka.app"

// Trust numbers don't need to be realtime
export const revalidate = 300

export const metadata: Metadata = {
  title: "ПОЛКА — маркетплейс готовых программ с проверкой кода",
  description:
    "Telegram-боты, парсеры, Excel- и 1С-скрипты, автоматизация. Код каждого продукта проходит сканирование и модерацию. Эскроу 7 дней, споры и возвраты.",
  openGraph: {
    title: "ПОЛКА — маркетплейс готовых программ с проверкой кода",
    description:
      "Готовые программные продукты для бизнеса с проверкой кода, эскроу и возвратами.",
    url: APP_URL,
    images: [{ url: `${APP_URL}/og-default.svg`, width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ПОЛКА — маркетплейс готовых программ с проверкой кода",
    description: "Готовые программы для бизнеса с проверкой кода, эскроу и возвратами.",
    images: [`${APP_URL}/og-default.svg`],
  },
}

const PRODUCT_CARD_SELECT = {
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
} as const

export default async function Home() {
  const [productCount, salesCount, scanCount, featured, grouped] = await Promise.all([
    db.product.count({ where: { status: "APPROVED" } }),
    db.purchase.count({ where: { status: { in: ["PAID", "DELIVERED"] } } }),
    db.scanResult.count({ where: { scannedAt: { not: null } } }),
    db.product.findMany({
      where: { status: "APPROVED" },
      orderBy: { salesCount: "desc" },
      take: 6,
      select: PRODUCT_CARD_SELECT,
    }),
    db.product.groupBy({
      by: ["category"],
      where: { status: "APPROVED" },
      _count: { _all: true },
    }),
  ])

  const counts = { TELEGRAM: 0, PARSER: 0, EXCEL: 0, AUTOMATION: 0, WEB: 0 } as Record<Category, number>
  for (const row of grouped) {
    counts[row.category as Category] = row._count._all
  }

  return (
    <>
      <Hero />
      <TrustBar productCount={productCount} scanCount={scanCount} salesCount={salesCount} />
      <FeaturedRow products={featured} />
      <HowItWorks />
      <SafetyBlock />
      <CategoryGrid counts={counts} />
      <DeveloperCTA />
    </>
  )
}
