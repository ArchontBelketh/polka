import type { MetadataRoute } from "next"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Приватные и служебные разделы из индекса убираем.
      disallow: [
        "/api/",
        "/admin",
        "/dashboard",
        "/purchases",
        "/settings",
        "/submit",
        "/ai-reviews",
        "/support",
        "/login",
        "/register",
        "/reset",
        "/verify",
        "/blocked",
        "/maintenance",
      ],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  }
}
