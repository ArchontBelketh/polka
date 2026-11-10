import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { ArrowUpRight, Code2, Heart, LifeBuoy, ShoppingBag } from "lucide-react"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/current-user"
import { canManageCode, isStaff } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { SellerOverview } from "@/components/dashboard/SellerOverview"
import { BecomeDeveloperButton } from "@/app/sell/BecomeDeveloperButton"

export const metadata = { title: "Мой кабинет", robots: { index: false, follow: false } }

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login?callbackUrl=/dashboard")

  const [purchases, wishlist, tickets] = await Promise.all([
    db.purchase.count({ where: { buyerId: user.id, status: { in: ["PAID", "DELIVERED"] } } }),
    db.wishlist.count({ where: { userId: user.id } }),
    db.supportTicket.count({ where: { authorId: user.id, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
  ])
  const developer = canManageCode(user.role)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2"><p className="text-xs uppercase tracking-widest text-cyan">Один аккаунт · два направления</p><h1 className="text-3xl font-semibold">Мой кабинет</h1><p className="text-sm text-muted-foreground">{user.name ? `${user.name}, здесь` : "Здесь"} ваши покупки, работа с кодом и настройки.</p></div>
        <Button asChild variant="outline"><Link href="/settings">Настройки аккаунта</Link></Button>
      </div>

      {isStaff(user.role) && <Link href="/admin" className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 text-sm hover:bg-accent">Рабочий стол {user.role === "ADMIN" ? "администратора" : "модератора"}<ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>}
      <section className="rounded-xl border border-cyan/25 bg-cyan/5 p-5 space-y-3"><h2 className="text-xl font-semibold">Заказы на разработку</h2><p className="text-sm text-muted-foreground">Ваши задачи, отклики, рабочие области и последние события.</p><div className="flex flex-wrap gap-3"><Button asChild><Link href="/dashboard/orders">Мои заказы и отклики</Link></Button><Button asChild variant="outline"><Link href="/orders/new">Разместить заказ</Link></Button><Button asChild variant="outline"><Link href="/orders">Найти заказ</Link></Button></div></section>

      <section aria-label="Покупки и обращения" className="grid gap-3 sm:grid-cols-3">
        <AccountCard href="/purchases" title="Мои покупки" value={purchases} hint="Оплаченный код и переписка с авторами" icon={<ShoppingBag aria-hidden="true" className="h-5 w-5 text-cyan" />} />
        <AccountCard href="/purchases?tab=wishlist" title="Избранное" value={wishlist} hint="Сохранённые решения из каталога" icon={<Heart aria-hidden="true" className="h-5 w-5 text-violet" />} />
        <AccountCard href="/support" title="Открытые обращения" value={tickets} hint="Вопросы и помощь по вашим сделкам" icon={<LifeBuoy aria-hidden="true" className="h-5 w-5 text-cyan" />} />
      </section>

      <section aria-label="Разработка и готовый код" className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6"><p className="text-xs uppercase tracking-widest text-cyan">Для вашей задачи</p><h2 className="text-xl font-semibold">Найти решение</h2><p className="flex-1 text-sm leading-relaxed text-muted-foreground">Выберите готовый код или опишите задачу в форме разработки на заказ.</p><div className="flex flex-wrap gap-2"><Button asChild><Link href="/catalog">Готовый код</Link></Button><Button asChild variant="outline"><Link href="/orders/new">Заказать разработку</Link></Button></div></div>
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-violet/25 bg-violet/5 p-5 sm:p-6"><Code2 aria-hidden="true" className="h-5 w-5 text-violet" /><h2 className="text-xl font-semibold">{developer ? "Ваш профиль разработчика" : "Представьте свою работу"}</h2><p className="flex-1 text-sm leading-relaxed text-muted-foreground">{developer ? "Расскажите о навыках, добавьте проекты и укажите доступность. Покупки и заказ разработки доступны в этом же аккаунте." : "Добавьте навыки и портфолио, продавайте свой код. Отдельная регистрация не нужна."}</p>{developer ? <div className="flex flex-wrap gap-2"><Button asChild><Link href="/dashboard/profile">Редактировать профиль</Link></Button><Button asChild variant="outline"><Link href={`/developer/${user.id}`}>Посмотреть профиль</Link></Button></div> : user.role === "BUYER" ? <BecomeDeveloperButton /> : <Button asChild variant="outline"><Link href="/settings">Настройки аккаунта</Link></Button>}</div>
      </section>

      {developer && <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Загружаем ваши продажи…</p>}><SellerOverview userId={user.id} /></Suspense>}
      <div className="flex flex-wrap gap-x-5 gap-y-3 border-t border-border pt-5 text-sm text-muted-foreground"><Link href="/services#my-orders" className="hover:text-foreground">История услуг</Link><Link href="/support" className="hover:text-foreground">Связаться с поддержкой</Link></div>
    </div>
  )
}

function AccountCard({ href, title, value, hint, icon }: { href: string; title: string; value: number; hint: string; icon: React.ReactNode }) {
  return <Link href={href} className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-cyan/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"><div className="flex items-center justify-between">{icon}<ArrowUpRight aria-hidden="true" className="h-4 w-4 text-muted-foreground group-hover:text-cyan" /></div><p className="mt-4 text-2xl font-semibold tabular-nums">{value}</p><h2 className="mt-1 text-sm font-medium">{title}</h2><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p></Link>
}
