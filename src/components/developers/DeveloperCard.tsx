import Link from "next/link"
import { ArrowUpRight, Code2 } from "lucide-react"
import { AVAILABILITY_LABELS, SPECIALIZATIONS, type Specialization } from "@/lib/developer-profile"
import type { DirectoryDeveloper } from "@/lib/developers/directory"

export function DeveloperCard({ developer }: { developer: DirectoryDeveloper }) {
  return <article data-developer-id={developer.id} className="flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-cyan/40">
    <div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet/25 bg-violet/10 text-violet"><Code2 aria-hidden="true" className="h-5 w-5" /></div><div className="min-w-0"><h2 className="break-words font-semibold"><Link href={`/developer/${developer.id}`} prefetch={false} className="rounded-sm underline-offset-4 hover:text-cyan hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan">{developer.name || "Разработчик"}<ArrowUpRight aria-hidden="true" className="ml-1 inline h-4 w-4" /></Link></h2><p className="mt-1 text-xs text-muted-foreground">{AVAILABILITY_LABELS[developer.availability]}</p></div></div>
    <p className="break-words text-sm leading-relaxed">{developer.headline}</p>
    <div className="flex flex-wrap gap-2">{developer.specializations.map(value => <span key={value} className="rounded-md bg-cyan/10 px-2 py-1 text-xs text-cyan">{SPECIALIZATIONS[value as Specialization] || value}</span>)}</div>
    <ul aria-label="Навыки" className="mt-auto flex flex-wrap gap-1.5">{developer.skills.slice(0, 8).map(skill => <li key={skill} className="max-w-full break-words rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">{skill}</li>)}{developer.skills.length > 8 && <li className="px-2 py-1 text-xs text-muted-foreground">Ещё {developer.skills.length - 8} в профиле</li>}</ul>
  </article>
}
