import type { Metadata } from "next"
import Link from "next/link"
import { ShieldAlert } from "lucide-react"

export const metadata: Metadata = {
  title: "Доступ ограничен",
  robots: { index: false, follow: false },
}

const REASONS: Record<string, string> = {
  vpn: "Похоже, вы заходите через VPN или прокси.",
  datacenter: "Запрос приходит из дата-центра (хостинга), а не от обычного провайдера.",
  geo: "Доступ к сервису ограничен по региону.",
}

const SUPPORT = process.env.SUPPORT_EMAIL ?? "support@cyberpolka.store"

export default async function BlockedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  const message = REASONS[reason ?? "vpn"] ?? REASONS.vpn

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet/30 bg-violet/10">
          <ShieldAlert className="h-8 w-8 text-violet" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">Доступ ограничен</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">{message}</p>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          Отключите VPN/прокси и обновите страницу. Если вы не используете их, напишите нам — поможем.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-xl bg-deep px-6 py-3 font-semibold text-white transition-colors hover:bg-violet"
          >
            Обновить
          </Link>
          <a
            href={`mailto:${SUPPORT}`}
            className="rounded-xl border border-border px-6 py-3 font-semibold text-foreground transition-colors hover:border-deep"
          >
            Написать в поддержку
          </a>
        </div>
      </div>
    </div>
  )
}
