"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface FeaturesStepProps {
  value: string[]
  onChange: (v: string[]) => void
}

export function FeaturesStep({ value, onChange }: FeaturesStepProps) {
  const [draft, setDraft] = useState("")

  function add() {
    const trimmed = draft.trim()
    if (!trimmed || value.length >= 20) return
    onChange([...value, trimmed])
    setDraft("")
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      add()
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Функции и возможности</h2>
        <p className="text-sm text-muted-foreground">
          Перечислите ключевые функции (минимум 1, максимум 20). Нажмите Enter или кнопку +.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="feature-input">Добавить функцию</Label>
        <div className="flex gap-2">
          <Input
            id="feature-input"
            placeholder="Например: Авто-напоминания за 1 день"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            maxLength={200}
          />
          <Button type="button" variant="outline" onClick={add} disabled={!draft.trim()}>
            +
          </Button>
        </div>
      </div>

      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((f, i) => (
            <li key={i} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
              <span className="flex items-center gap-2 text-sm">
                <span className="text-primary">✓</span>
                {f}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-muted-foreground hover:text-red-500 transition-colors"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {value.length === 0 && (
        <p className="text-sm text-muted-foreground italic">Ещё нет функций — добавьте хотя бы одну.</p>
      )}
    </div>
  )
}
