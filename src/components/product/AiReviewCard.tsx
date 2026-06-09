import type { AiReviewResult } from "@/lib/ai-review/prompt"
import { Badge } from "@/components/ui/badge"

interface Props {
  result: AiReviewResult
  createdAt: string | Date
}

const COMPLEXITY_LABEL = { EASY: "Простая", MEDIUM: "Средняя", HARD: "Сложная" } as const

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 10) * 100
  const color = score >= 7 ? "bg-green-500" : score >= 4 ? "bg-yellow-500" : "bg-red-500"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-6 text-right">{score}/10</span>
    </div>
  )
}

export function AiReviewCard({ result, createdAt }: Props) {
  const date = new Date(createdAt).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric",
  })

  const overallColor =
    result.overall_score >= 7 ? "text-green-400"
    : result.overall_score >= 4 ? "text-yellow-400"
    : "text-red-400"

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-bold ${overallColor}`}>{result.overall_score}/10</span>
          <span className="text-sm text-muted-foreground">Общая оценка</span>
        </div>
        <span className="text-xs text-muted-foreground">{date}</span>
      </div>

      {/* Verdict */}
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
        {result.verdict}
      </div>

      {/* Category scores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: "Качество кода",         score: result.quality.score,      summary: result.quality.summary },
          { label: "Безопасность",           score: result.security.score,     summary: result.security.summary },
          { label: "Соответствие описанию",  score: result.accuracy.score,     summary: result.accuracy.summary },
          { label: "Документация",           score: result.docs.score,         summary: result.docs.summary },
        ].map(({ label, score, summary }) => (
          <div key={label} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{label}</span>
            </div>
            <ScoreBar score={score} />
            <p className="text-xs text-muted-foreground">{summary}</p>
          </div>
        ))}
      </div>

      {/* Installation */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Установка</span>
          <ScoreBar score={result.installation.score} />
          <Badge variant="outline" className="text-xs shrink-0">
            {COMPLEXITY_LABEL[result.installation.complexity]}
          </Badge>
        </div>
        {result.installation.requirements.length > 0 && (
          <ul className="text-xs text-muted-foreground space-y-0.5 pl-2">
            {result.installation.requirements.map((r, i) => (
              <li key={i}>· {r}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Issues */}
      {result.quality.issues.length > 0 && (
        <Detail title="Замечания по коду" items={result.quality.issues} variant="warning" />
      )}
      {result.security.issues.length > 0 && (
        <Detail title="Замечания по безопасности" items={result.security.issues} variant="danger" />
      )}
      {result.accuracy.missing.length > 0 && (
        <Detail title="Не описано в документации" items={result.accuracy.missing} variant="warning" />
      )}
      {result.hidden_costs.length > 0 && (
        <Detail title="Скрытые требования" items={result.hidden_costs} variant="info" />
      )}
      {result.recommended_for.length > 0 && (
        <Detail title="Подходит для" items={result.recommended_for} variant="success" />
      )}
    </div>
  )
}

function Detail({
  title, items, variant,
}: {
  title: string
  items: string[]
  variant: "warning" | "danger" | "info" | "success"
}) {
  const colors = {
    warning: "border-yellow-500/30 bg-yellow-500/5 text-yellow-300",
    danger:  "border-red-500/30    bg-red-500/5    text-red-400",
    info:    "border-border         bg-muted/30     text-muted-foreground",
    success: "border-green-500/30  bg-green-500/5  text-green-400",
  }
  return (
    <div className={`rounded-lg border px-4 py-3 space-y-1.5 ${colors[variant]}`}>
      <p className="text-xs font-semibold">{title}</p>
      <ul className="space-y-0.5">
        {items.map((item, i) => (
          <li key={i} className="text-xs">· {item}</li>
        ))}
      </ul>
    </div>
  )
}
