import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CYBERПОЛКА — готовый код и разработка",
    short_name: "CYBERПОЛКА",
    description: "Готовые боты, скрипты и интеграции. Найдите подходящий код или опишите задачу на разработку.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0912",
    theme_color: "#0a0912",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
