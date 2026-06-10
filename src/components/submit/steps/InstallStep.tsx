"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { X } from "lucide-react"

const MIN_GUIDE = 200
const MAX_REQUIREMENTS = 15

interface InstallData {
  installGuide: string
  requirements: string[]
}

interface InstallStepProps {
  value: InstallData
  onChange: (v: Partial<InstallData>) => void
}

const SUGGESTIONS = ["Python 3.10+", "Windows 10/11", "1С 8.3.20+", "Node.js 18+", "MS Excel 2016+", "Доступ в интернет"]

export function InstallStep({ value, onChange }: InstallStepProps) {
  const [draft, setDraft] = useState("")
  const guideLen = value.installGuide.trim().length

  function addReq(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed || value.requirements.includes(trimmed) || value.requirements.length >= MAX_REQUIREMENTS) return
    onChange({ requirements: [...value.requirements, trimmed] })
    setDraft("")
  }

  function removeReq(i: number) {
    onChange({ requirements: value.requirements.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Установка и требования</h2>
        <p className="text-sm text-muted-foreground">
          Инструкция избавит вас от споров «не смог запустить». Полная версия откроется покупателю
          после оплаты, до покупки видны только системные требования и краткий анонс.
        </p>
      </div>

      {/* Requirements */}
      <div className="space-y-2">
        <Label htmlFor="req-input">Системные требования</Label>
        <div className="flex gap-2">
          <Input
            id="req-input"
            placeholder="Например: Python 3.10+"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addReq(draft)
              }
            }}
            maxLength={100}
          />
          <Button type="button" variant="outline" onClick={() => addReq(draft)} disabled={!draft.trim()}>
            +
          </Button>
        </div>

        {value.requirements.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {value.requirements.map((r, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-0.5 text-xs"
              >
                {r}
                <button type="button" onClick={() => removeReq(i)} className="opacity-60 hover:opacity-100">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 pt-1">
          {SUGGESTIONS.filter((s) => !value.requirements.includes(s)).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addReq(s)}
              disabled={value.requirements.length >= MAX_REQUIREMENTS}
              className="rounded border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-foreground/40 hover:text-foreground disabled:opacity-30"
            >
              + {s}
            </button>
          ))}
        </div>
      </div>

      {/* Install guide */}
      <div className="space-y-2">
        <Label htmlFor="installGuide">Инструкция по установке * <span className="font-normal text-muted-foreground">(Markdown)</span></Label>
        <Textarea
          id="installGuide"
          placeholder={"## Установка\n1. Распакуйте архив\n2. Установите зависимости: `pip install -r requirements.txt`\n3. Запустите `python main.py`\n\n## Настройка\nУкажите токен бота в файле config.ini…"}
          value={value.installGuide}
          onChange={(e) => onChange({ installGuide: e.target.value })}
          rows={10}
          className="font-mono text-sm"
        />
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Поддерживается: заголовки <code>#</code>, списки, <code>`код`</code>, <code>**жирный**</code>, ссылки
          </span>
          <span className={guideLen >= MIN_GUIDE ? "text-muted-foreground" : "text-destructive"}>
            {guideLen}/{MIN_GUIDE}
            {guideLen < MIN_GUIDE && ` — нужно ещё ${MIN_GUIDE - guideLen}`}
          </span>
        </div>
      </div>
    </div>
  )
}
