import Link from "next/link"
import { Package } from "lucide-react"

const COLUMNS = [
  {
    title: "Маркетплейс",
    links: [
      { href: "/catalog", label: "Каталог" },
      { href: "/catalog?sort=popular", label: "Популярное" },
      { href: "/catalog?sort=newest", label: "Новинки" },
    ],
  },
  {
    title: "Разработчикам",
    links: [
      { href: "/sell", label: "Продавать" },
      { href: "/submit", label: "Загрузить продукт" },
      { href: "/dashboard", label: "Кабинет разработчика" },
    ],
  },
  {
    title: "Поддержка",
    links: [
      { href: "/purchases", label: "Мои покупки" },
      { href: "/support", label: "Помощь" },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/30">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 space-y-3 sm:col-span-1">
            <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
              <Package className="h-5 w-5 text-primary" />
              <span>Полка</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Маркетплейс готовых программ с проверкой кода.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title} className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} ПОЛКА — маркетплейс готовых программ
        </div>
      </div>
    </footer>
  )
}
