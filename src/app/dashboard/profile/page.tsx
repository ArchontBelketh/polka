import Link from "next/link"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/current-user"
import { canManageCode } from "@/lib/permissions"
import { readPortfolio } from "@/lib/developer-profile"
import { BecomeDeveloperButton } from "@/app/sell/BecomeDeveloperButton"
import { DeveloperProfileForm } from "./DeveloperProfileForm"

export const metadata = { title: "Профиль разработчика", robots: { index: false, follow: false } }

export default async function DeveloperProfileSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login?callbackUrl=/dashboard/profile")

  if (!canManageCode(user.role)) return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Кабинет</Link>
      <h1 className="text-2xl font-semibold">Профиль разработчика</h1>
      <p className="text-muted-foreground">Расскажите о навыках и проектах, чтобы представить свою работу. Покупать готовый код и заказывать разработку можно с этим же аккаунтом.</p>
      {user.role === "BUYER" ? <div className="rounded-2xl border border-border bg-card p-6"><BecomeDeveloperButton /></div>
        : <p className="text-sm text-muted-foreground">Для этого аккаунта включены полномочия модератора. Настройки личных данных доступны в <Link href="/settings" className="text-cyan underline">настройках аккаунта</Link>.</p>}
    </div>
  )

  const [profile, listing] = await Promise.all([
    db.developerProfile.findUnique({ where: { userId: user.id } }),
    db.developerListing.findUnique({ where: { userId: user.id }, select: { enabled: true } }),
  ])
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-7">
      <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Кабинет</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2"><h1 className="text-2xl font-semibold">Профиль разработчика</h1><p className="max-w-xl text-sm text-muted-foreground">Сохранённые сведения видны в вашем публичном профиле. Добавляйте только проекты, которые имеете право показывать.</p></div>
        <Link href={`/developer/${user.id}`} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">Открыть профиль</Link>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Имя и описание «О себе» редактируются в <Link href="/settings#personal-info" className="text-cyan underline underline-offset-4">настройках аккаунта</Link>. Email, телефон и реквизиты в этом профиле не публикуются.
      </div>
      <DeveloperProfileForm initial={{
        listed: listing?.enabled ?? false,
        headline: profile?.headline ?? "",
        skills: profile?.skills ?? [],
        specializations: profile?.specializations ?? [],
        availability: profile?.availability ?? "UNAVAILABLE",
        portfolio: readPortfolio(profile?.portfolio),
      }} />
    </div>
  )
}
