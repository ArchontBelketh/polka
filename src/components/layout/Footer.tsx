import Link from "next/link"
import { getOperatorInfo, operatorShortLine } from "@/lib/operator"
import { CookieSettingsLink } from "./CookieSettingsLink"
import { Brand } from "./Brand"

const COLUMNS = [
  {
    title: "Платформа",
    links: [
      { href: "/catalog", label: "Готовый код" },
      { href: "/orders", label: "Заказы на разработку" },
      { href: "/developers", label: "Разработчики" },
      { href: "/orders/new", label: "Разместить заказ" },
      { href: "/how-we-check", label: "Проверка и модерация" },
    ],
  },
  {
    title: "Разработчикам",
    links: [
      { href: "/sell", label: "Продавать код" },
      { href: "/orders", label: "Найти заказ" },
      { href: "/submit", label: "Разместить код" },
      { href: "/how-to-get-paid", label: "Как принимать оплату" },
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
  {
    title: "Документы",
    links: [
      { href: "/legal/offer", label: "Оферта" },
      { href: "/legal/tariffs", label: "Тарифы" },
      { href: "/legal/terms", label: "Соглашение" },
      { href: "/legal/privacy", label: "Политика ПДн" },
      { href: "/rights-complaint", label: "Жалоба правообладателя" },
    ],
  },
]

export async function Footer() {
  const op = await getOperatorInfo()
  return (
    <footer className="mt-12 border-t border-border bg-[#0b0a12]">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-14 sm:grid-cols-3 sm:px-6 lg:grid-cols-5">
        <div className="col-span-2 space-y-4 sm:col-span-3 lg:col-span-1">
          <Link href="/" aria-label="CYBERПОЛКА — на главную" className="inline-flex rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"><Brand /></Link>
          <p className="max-w-[280px] text-sm leading-relaxed text-muted-foreground">
            Готовый код и разработка под вашу задачу. Боты, интеграции и автоматизация для бизнеса.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title} className="space-y-4">
            <h3 className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">{col.title}</h3>
            <ul className="space-y-2.5">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="rounded-sm text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto max-w-7xl space-y-2 px-4 py-6 text-xs text-muted-foreground sm:px-6">
          {(op.name || op.inn || op.ogrn || op.email) && <p>{operatorShortLine(op)}</p>}
          <p>© {new Date().getFullYear()} CYBERПОЛКА — готовый код и разработка</p>
          <p><CookieSettingsLink /></p>
        </div>
      </div>
    </footer>
  )
}
