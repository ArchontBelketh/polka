import type { MetadataRoute } from "next"
import { db } from "@/lib/db"
import type { Category } from "@/types"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

// Генерируем на сервере по запросу (нужна БД) — не пререндерим на этапе билда,
// где БД недоступна.
export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${APP_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${APP_URL}/catalog`, changeFrequency: "daily", priority: 0.9 },
    { url: `${APP_URL}/sell`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${APP_URL}/legal/offer`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${APP_URL}/legal/tariffs`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${APP_URL}/legal/terms`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${APP_URL}/legal/privacy`, changeFrequency: "monthly", priority: 0.3 },
  ]

  try {
    // Категории — только непустые (пустые/«скоро» в карту не кладём).
    const catCounts = await db.product.groupBy({
      by: ["category"],
      where: { status: "APPROVED" },
      _count: { _all: true },
    })
    const categoryRoutes: MetadataRoute.Sitemap = catCounts
      .filter((c) => c._count._all > 0)
      .map((c) => ({
        url: `${APP_URL}/catalog?category=${c.category as Category}`,
        changeFrequency: "weekly",
        priority: 0.6,
      }))

    // Все одобренные продукты.
    const products = await db.product.findMany({
      where: { status: "APPROVED" },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
      take: 5000,
    })
    const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
      url: `${APP_URL}/product/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }))

    return [...staticRoutes, ...categoryRoutes, ...productRoutes]
  } catch (err) {
    // Если БД временно недоступна — отдаём хотя бы статические маршруты.
    console.error("sitemap: db error, returning static routes only", err)
    return staticRoutes
  }
}
