import Link from "next/link"
import { getOperatorInfo, operatorShortLine } from "@/lib/operator"

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
  {
    title: "Документы",
    links: [
      { href: "/legal/offer", label: "Оферта" },
      { href: "/legal/tariffs", label: "Тарифы" },
      { href: "/legal/terms", label: "Соглашение" },
      { href: "/legal/privacy", label: "Политика ПДн" },
    ],
  },
]

export async function Footer() {
  const op = await getOperatorInfo()
  return (
    <footer className="mt-24 border-t border-border bg-[#0b0a12]">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-14 sm:grid-cols-3 lg:grid-cols-5">
        <div className="col-span-2 space-y-4 sm:col-span-3 lg:col-span-1">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-border bg-[#100e1a]">
              <span className="flex flex-col items-start gap-[2.5px]">
                <span className="flex items-end gap-[2.5px]">
                  <span className="font-mono text-[12px] font-extrabold leading-none text-violet">&gt;</span>
                  <span className="flex items-end gap-[2px]">
                    <span className="h-[6px] w-[3px] rounded-[1px] bg-cyan" />
                    <span className="h-[9px] w-[3px] rounded-[1px] bg-violet" />
                  </span>
                </span>
                <span className="h-[2.5px] w-[21px] rounded-[2px] bg-deep" />
              </span>
            </span>
            <span className="text-[15px] font-extrabold tracking-[0.06em]">
              <span className="text-cyan">CYBER</span>
              <span className="text-foreground">ПОЛКА</span>
            </span>
          </Link>
          <p className="max-w-[280px] text-sm leading-relaxed text-muted-foreground">
            Маркетплейс готовых программ с проверкой кода. Автоскан и ручная модерация — на каждой сделке.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title} className="space-y-4">
            <h3 className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">{col.title}</h3>
            <ul className="space-y-2.5">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto max-w-7xl space-y-1 px-4 py-6 font-mono text-xs text-muted-foreground">
          <p>{operatorShortLine(op)}</p>
          <p>© {new Date().getFullYear()} CYBERПОЛКА — маркетплейс готовых программ</p>
        </div>
      </div>
    </footer>
  )
}
