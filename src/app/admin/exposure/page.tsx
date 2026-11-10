import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/current-user"
import { isStaff } from "@/lib/permissions"
import { metricsEnabled, readExposureReport, SIGNAL_LABELS, COHORT_LABELS } from "@/lib/developers/metrics"

export const metadata = { title: "Видимость разработчиков", robots: { index: false, follow: false } }
export default async function ExposurePage() {
  const actor = await getCurrentUser(); if (!actor) redirect("/login?callbackUrl=/admin/exposure"); if (!isStaff(actor.role)) redirect("/dashboard")
  let report: Awaited<ReturnType<typeof readExposureReport>> | null = null, failed = false
  if (metricsEnabled()) try { report = await readExposureReport() } catch { failed = true }
  return <div className="mx-auto max-w-5xl space-y-6 px-4 py-8"><Link className="text-sm text-cyan hover:underline" href="/admin">← Рабочий стол</Link><h1 className="text-3xl font-semibold">Видимость разработчиков</h1><p className="text-sm leading-relaxed text-muted-foreground">Последние 30 календарных дней по UTC. Группа определяется числом завершённых и опубликованных заказов в момент события; текущий заказ не учитывается. Оценки и продажи готового кода не входят в эти данные.</p>
    {!metricsEnabled() && <p className="rounded-xl border border-border p-5 text-sm text-muted-foreground">Сбор событий отключён в настройках окружения. Отсутствие данных не означает отсутствие посещений или сделок.</p>}{failed && <p role="alert">Не удалось загрузить статистику. Повторите позже.</p>}
    {report && <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-sm"><caption className="sr-only">События по опыту в заказной разработке</caption><thead className="bg-card text-left"><tr><th className="p-4">Событие</th>{Object.values(COHORT_LABELS).map(label => <th className="p-4" key={label}>{label}</th>)}</tr></thead><tbody>{report.map(row => <tr key={row.kind} className="border-t border-border"><th className="p-4 text-left font-medium">{SIGNAL_LABELS[row.kind]}</th><td className="p-4 tabular-nums">{row.first}</td><td className="p-4 tabular-nums">{row.recorded}</td></tr>)}</tbody></table></div>}
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground"><p>Показ — минимум половина карточки видна секунду. Открытие — профиль виден секунду. Эти два события собираются только с согласием на аналитические cookie; повтор для одного профиля и браузера за день исключается.</p><p>Отклики, приглашения и переходы сделки фиксируются сервером. Повторная отправка, редактирование отклика или повторное открытие спора не увеличивают счётчик. Спор означает обращение в поддержку, а не доказанное нарушение разработчика.</p><p>Это отдельные количества событий, а не конверсия одних и тех же посетителей. Cookie можно сбросить, разные аккаунты могут принадлежать одному человеку. Данные нужны для пилота; они не определяют позиции или санкции автоматически.</p></div>
  </div>
}
