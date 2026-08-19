import Link from "next/link"

const DOCS = [
  { href: "/legal/offer", label: "Оферта" },
  { href: "/legal/tariffs", label: "Тарифы" },
  { href: "/legal/terms", label: "Соглашение" },
  { href: "/legal/privacy", label: "Политика ПДн" },
]

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <nav className="mb-8 flex flex-wrap gap-x-4 gap-y-2 border-b border-border pb-4 text-sm">
        {DOCS.map((d) => (
          <Link key={d.href} href={d.href} className="text-muted-foreground hover:text-foreground">
            {d.label}
          </Link>
        ))}
      </nav>

      <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
        ⚠️ Черновик-шаблон. Перед запуском замените тексты на согласованные с юристом
        (модель «площадка-агент»: ПОЛКА — посредник между разработчиком и покупателем).
        Подставьте реквизиты ИП/ООО.
      </div>

      <article
        className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground
          [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mb-1
          [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-6 [&_h2]:mb-1
          [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_li]:leading-relaxed
          [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline"
      >
        {children}
      </article>
    </div>
  )
}
