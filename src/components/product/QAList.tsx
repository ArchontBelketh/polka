"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AnswerForm } from "./AnswerForm"
import { MessageCircleQuestion, EyeOff } from "lucide-react"

export interface QAItem {
  id: string
  question: string
  answer: string | null
  answeredAt: string | null
  createdAt: string
  authorName: string | null
}

interface QAListProps {
  questions: QAItem[]
  isAuthor: boolean
  isModerator: boolean
}

const INITIAL_VISIBLE = 5

export function QAList({ questions, isAuthor, isModerator }: QAListProps) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  if (questions.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        Вопросов пока нет. Задайте первый — автор получит уведомление.
      </p>
    )
  }

  const visible = expanded ? questions : questions.slice(0, INITIAL_VISIBLE)

  async function hide(id: string) {
    const res = await fetch(`/api/questions/${id}`, { method: "DELETE" })
    if (res.ok) router.refresh()
  }

  return (
    <div className="space-y-3">
      {visible.map((q) => (
        <div key={q.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
          {/* Question */}
          <div className="flex items-start gap-2">
            <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground whitespace-pre-wrap">{q.question}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {q.authorName ?? "Пользователь"} · {new Date(q.createdAt).toLocaleDateString("ru-RU")}
              </p>
            </div>
            {!q.answer && (
              <Badge variant="outline" className="shrink-0 text-xs text-yellow-400">
                Ожидает ответа
              </Badge>
            )}
            {isModerator && (
              <button
                type="button"
                onClick={() => hide(q.id)}
                title="Скрыть вопрос"
                className="shrink-0 text-muted-foreground hover:text-red-400"
              >
                <EyeOff className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Answer */}
          {editing === q.id ? (
            <div className="ml-6 border-l-2 border-primary/30 pl-3">
              <AnswerForm
                questionId={q.id}
                initialAnswer={q.answer}
                onCancel={() => setEditing(null)}
              />
            </div>
          ) : q.answer ? (
            <div className="ml-6 border-l-2 border-primary/30 pl-3 space-y-1">
              <p className="text-xs font-medium text-primary">Ответ автора</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{q.answer}</p>
              {isAuthor && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setEditing(q.id)}
                >
                  Изменить ответ
                </Button>
              )}
            </div>
          ) : (
            isAuthor && (
              <div className="ml-6">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => setEditing(q.id)}
                >
                  Ответить
                </Button>
              </div>
            )
          )}
        </div>
      ))}

      {questions.length > INITIAL_VISIBLE && !expanded && (
        <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
          Показать все вопросы ({questions.length})
        </Button>
      )}
    </div>
  )
}
