"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AVAILABILITY_LABELS, SPECIALIZATIONS, type Availability, type PortfolioItem } from "@/lib/developer-profile"

export interface ProfileFormValue {
  listed?: boolean
  headline: string
  skills: string[]
  specializations: string[]
  availability: Availability
  portfolio: PortfolioItem[]
}

const fieldClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function DeveloperProfileForm({ initial }: { initial: ProfileFormValue }) {
  const router = useRouter()
  const [headline, setHeadline] = useState(initial.headline)
  const [listed, setListed] = useState(initial.listed ?? false)
  const [skills, setSkills] = useState(initial.skills.join(", "))
  const [specializations, setSpecializations] = useState(initial.specializations)
  const [availability, setAvailability] = useState(initial.availability)
  const [portfolio, setPortfolio] = useState(initial.portfolio)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  function updateProject(index: number, key: keyof PortfolioItem, value: string) {
    setPortfolio((items) => items.map((item, i) => i === index ? { ...item, [key]: value } : item))
    setSaved(false)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true); setError(""); setSaved(false)
    try {
      const response = await fetch("/api/developer/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listed, headline, skills: skills.split(",").map((item) => item.trim()).filter(Boolean), specializations, availability, portfolio }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { setError(typeof data.error === "string" ? data.error : "Не удалось сохранить профиль"); return }
      setSaved(true)
      router.refresh()
    } catch { setError("Ошибка сети. Данные формы сохранены на странице — попробуйте ещё раз.") }
    finally { setPending(false) }
  }

  return (
    <form onSubmit={submit} onChange={() => setSaved(false)} className="space-y-7" aria-label="Публичный профиль разработчика">
      <fieldset disabled={pending} className="min-w-0 space-y-6 disabled:opacity-70">
        <legend className="sr-only">Навыки и доступность</legend>
        <div className="rounded-xl border border-cyan/30 bg-cyan/5 p-4 space-y-2"><label className="flex items-start gap-3 text-sm font-medium"><input type="checkbox" checked={listed} onChange={event => setListed(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />Показывать меня в каталоге разработчиков</label><p className="text-xs leading-relaxed text-muted-foreground">Участие бесплатно. Заполните навыки, направления и специализацию в одной строке (от 10 символов). Порядок подходящих профилей меняется ежедневно. Если сейчас не берёте заказы, профиль виден только с фильтром «Любая доступность».</p></div>
        <div className="space-y-2"><label htmlFor="dev-headline" className="text-sm font-medium">Специализация в одной строке</label><Input id="dev-headline" value={headline} onChange={(event) => setHeadline(event.target.value)} maxLength={120} placeholder="Например: интеграции 1С и Telegram-боты" /></div>
        <fieldset className="space-y-3"><legend className="mb-2 text-sm font-medium">Направления работы</legend><div className="flex flex-wrap gap-2">
          {Object.entries(SPECIALIZATIONS).map(([value, label]) => <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"><input type="checkbox" checked={specializations.includes(value)} onChange={(event) => setSpecializations((items) => event.target.checked ? [...items, value] : items.filter((item) => item !== value))} className="h-4 w-4 accent-primary" />{label}</label>)}
        </div></fieldset>
        <div className="space-y-2"><label htmlFor="dev-skills" className="text-sm font-medium">Навыки</label><Input id="dev-skills" value={skills} onChange={(event) => setSkills(event.target.value)} maxLength={850} aria-describedby="dev-skills-hint" placeholder="TypeScript, Python, PostgreSQL" /><p id="dev-skills-hint" className="text-xs text-muted-foreground">Через запятую: до 20 навыков, каждый до 40 символов.</p></div>
        <div className="space-y-2"><label htmlFor="dev-availability" className="text-sm font-medium">Доступность</label><select id="dev-availability" value={availability} onChange={(event) => setAvailability(event.target.value as Availability)} className={fieldClass}>{Object.entries(AVAILABILITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><p className="text-xs text-muted-foreground">Укажите текущую загрузку. Статус виден посетителям профиля.</p></div>
        <section aria-labelledby="portfolio-heading" className="space-y-4">
          <div><h2 id="portfolio-heading" className="text-lg font-semibold">Портфолио</h2><p className="mt-1 text-sm text-muted-foreground">До 6 проектов. Ссылка необязательна; используйте HTTPS и не добавляйте приватные материалы заказчиков.</p></div>
          {portfolio.length === 0 && <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Добавьте проект и опишите, какую задачу вы решили.</p>}
          {portfolio.map((item, index) => <fieldset key={index} className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4">
            <legend className="px-2 text-sm font-medium">Проект {index + 1}</legend>
            <div className="space-y-1.5"><label htmlFor={`project-title-${index}`} className="text-sm">Название</label><Input id={`project-title-${index}`} value={item.title} onChange={(event) => updateProject(index, "title", event.target.value)} minLength={2} maxLength={100} required /></div>
            <div className="space-y-1.5"><label htmlFor={`project-desc-${index}`} className="text-sm">Задача и ваш вклад</label><textarea id={`project-desc-${index}`} value={item.description} onChange={(event) => updateProject(index, "description", event.target.value)} maxLength={600} rows={3} className={fieldClass} /></div>
            <div className="space-y-1.5"><label htmlFor={`project-url-${index}`} className="text-sm">Ссылка на проект</label><Input id={`project-url-${index}`} type="url" value={item.url} onChange={(event) => updateProject(index, "url", event.target.value)} maxLength={500} placeholder="https://…" /></div>
            <Button type="button" variant="outline" size="sm" aria-label={`Удалить проект ${index + 1}`} onClick={() => { setPortfolio((items) => items.filter((_, i) => i !== index)); setSaved(false) }}>Удалить проект</Button>
          </fieldset>)}
          <Button type="button" variant="outline" disabled={portfolio.length >= 6} onClick={() => { setPortfolio((items) => [...items, { title: "", description: "", url: "" }]); setSaved(false) }}>Добавить проект</Button>
        </section>
      </fieldset>
      <div className="flex flex-wrap items-center gap-4"><Button type="submit" disabled={pending}>{pending ? "Сохранение…" : "Сохранить профиль"}</Button>{saved && <p role="status" className="text-sm text-green-400">Профиль сохранён</p>}{error && <p role="alert" className="max-w-xl text-sm text-red-400">{error}</p>}</div>
    </form>
  )
}
