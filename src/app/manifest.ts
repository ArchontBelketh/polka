import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CYBERПОЛКА — маркетплейс готовых программ",
    short_name: "CYBERПОЛКА",
    description: "Готовые программы для бизнеса с проверкой кода, эскроу и возвратами.",
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
