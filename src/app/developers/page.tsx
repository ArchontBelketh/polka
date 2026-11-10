import Link from "next/link"
import { UsersRound, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SPECIALIZATIONS } from "@/lib/developer-profile"
import { parseDeveloperQuery } from "@/lib/developers/query"
import { readDeveloperDirectory, DIRECTORY_PAGE_SIZE } from "@/lib/developers/directory"
import { exposureToken } from "@/lib/developers/metrics"
import { DeveloperCard } from "@/components/developers/DeveloperCard"
import { ExposureTracker } from "@/components/developers/ExposureTracker"

export const dynamic = "force-dynamic"
export const metadata = { title: "Разработчики", description: "Навыки, направления и доступность разработчиков. Найдите исполнителя и пригласите откликнуться на ваш заказ.", alternates: { canonical: "/developers" } }
const field = "min-w-0 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
export default async function DevelopersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams, parsed = parseDeveloperQuery(params)
  const value = parsed.success ? parsed.value : null
  let result: Awaited<ReturnType<typeof readDeveloperDirectory>> | null = null, unavailable = false
  if (value) try { result = await readDeveloperDirectory(value) } catch { unavailable = true; console.error("Developer directory could not be loaded") }
  const pageLink = (page: number) => { const search = new URLSearchParams(); if (value) for (const [key, item] of Object.entries(value)) if (key !== "page" && item) search.set(key, String(item)); search.set("page", String(page)); return `/developers?${search}` }
  return <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
    <div className="flex flex-wrap items-start justify-between gap-5"><div className="max-w-2xl space-y-3"><p className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-cyan"><UsersRound aria-hidden="true" className="h-4 w-4" />Люди за кодом</p><h1 className="text-3xl font-semibold sm:text-4xl">Разработчики</h1><p className="text-sm leading-relaxed text-muted-foreground">Найдите человека под задачу: смотрите навыки, проекты и текущую доступность. Из профиля можно пригласить разработчика откликнуться на ваш опубликованный заказ.</p></div><Button asChild variant="outline"><Link href="/dashboard/profile">Добавить свой профиль <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></Button></div>
    <form action="/developers" method="get" aria-label="Фильтры разработчиков" className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4 lg:p-5">
      <div className="space-y-2"><label htmlFor="developer-query" className="text-sm font-medium">Имя или специализация</label><input id="developer-query" name="q" maxLength={120} defaultValue={value?.q ?? ""} className={field} placeholder="Например: интеграции" /></div>
      <div className="space-y-2"><label htmlFor="developer-specialization" className="text-sm font-medium">Направление</label><select id="developer-specialization" name="specialization" defaultValue={value?.specialization ?? ""} className={field}><option value="">Все направления</option>{Object.entries(SPECIALIZATIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      <div className="space-y-2"><label htmlFor="developer-skill" className="text-sm font-medium">Навык целиком</label><input id="developer-skill" name="skill" maxLength={40} defaultValue={value?.skill ?? ""} className={field} placeholder="TypeScript" /><p className="text-xs text-muted-foreground">Точное название с учётом регистра.</p></div>
      <div className="space-y-2"><label htmlFor="developer-availability" className="text-sm font-medium">Доступность</label><select id="developer-availability" name="availability" defaultValue={value?.availability ?? "READY"} className={field}><option value="READY">Открыт или доступен частично</option><option value="AVAILABLE">Открыт к предложениям</option><option value="LIMITED">Ограниченная доступность</option><option value="ALL">Любая доступность</option></select></div>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4"><Button type="submit">Применить</Button><Link href="/developers" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Сбросить</Link></div>
    </form>
    <div className="rounded-xl border border-violet/20 bg-violet/5 px-5 py-4 text-sm leading-relaxed text-muted-foreground">Сначала выбирайте нужные навыки и доступность. Порядок подходящих профилей сдвигается каждый день по UTC: новичок может оказаться первым наравне с опытным автором. Отзывы и платные планы порядок не меняют. Навыки указаны самими разработчиками.</div>
    {!parsed.success && <p role="alert" className="rounded-xl border border-destructive/40 p-5 text-sm">{parsed.error}</p>}
    {unavailable && <p role="alert" className="rounded-xl border border-border p-5 text-sm text-muted-foreground">Не удалось загрузить каталог разработчиков. Попробуйте обновить страницу позже.</p>}
    {result && <><p role="status" className="text-sm text-muted-foreground">Найдено профилей: {result.total}</p>{result.items.length ? <ExposureTracker token={exposureToken("IMPRESSION", result.items.map(item => item.id))}><div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">{result.items.map(developer => <DeveloperCard key={developer.id} developer={developer} />)}</div></ExposureTracker> : <div className="rounded-2xl border border-dashed border-border p-8 text-center"><h2 className="text-xl font-semibold">{result.total ? "На этой странице нет профилей" : "Подходящих профилей пока нет"}</h2><p className="mt-3 text-sm text-muted-foreground">Измените фильтры или разместите заказ, чтобы разработчики могли откликнуться сами.</p><Link href="/orders/new" className="mt-4 inline-block text-sm text-cyan hover:underline">Разместить заказ →</Link></div>}
      {(result.page > 1 || result.page * DIRECTORY_PAGE_SIZE < result.total) && <nav aria-label="Страницы разработчиков" className="flex flex-wrap items-center gap-5 text-sm">{result.page > 1 && <Link className="text-cyan hover:underline" href={pageLink(result.page - 1)}>← Назад</Link>}<span>Страница {result.page}</span>{result.page * DIRECTORY_PAGE_SIZE < result.total && <Link className="text-cyan hover:underline" href={pageLink(result.page + 1)}>Далее →</Link>}</nav>}</>}
  </div>
}
