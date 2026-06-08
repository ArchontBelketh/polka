"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { TECH_GROUPS, TECH_COLOR_CLASSES, getTechTagColor } from "@/lib/tech-tags"

const MAX_TAGS = 10

const PREDEFINED_LABELS = new Set(
  TECH_GROUPS.flatMap(g => g.tags.map(t => t.label)),
)

interface TechStackPickerProps {
  value: string[]
  onChange: (v: string[]) => void
}

export function TechStackPicker({ value, onChange }: TechStackPickerProps) {
  const [custom, setCustom] = useState("")

  function toggle(label: string) {
    if (value.includes(label)) {
      onChange(value.filter(t => t !== label))
    } else if (value.length < MAX_TAGS) {
      onChange([...value, label])
    }
  }

  function addCustom() {
    const trimmed = custom.trim()
    if (!trimmed || value.includes(trimmed) || value.length >= MAX_TAGS) return
    onChange([...value, trimmed])
    setCustom("")
  }

  const customTags = value.filter(t => !PREDEFINED_LABELS.has(t))

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-3">
      {TECH_GROUPS.map(group => (
        <div key={group.group} className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {group.group}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {group.tags.map(tag => {
              const selected = value.includes(tag.label)
              const colorCls = TECH_COLOR_CLASSES[tag.color]
              return (
                <button
                  key={tag.label}
                  type="button"
                  onClick={() => toggle(tag.label)}
                  disabled={!selected && value.length >= MAX_TAGS}
                  className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium transition-all
                    ${selected
                      ? `${colorCls} scale-105`
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                    }
                    disabled:cursor-not-allowed disabled:opacity-30`}
                >
                  {tag.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {customTags.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Свои теги
          </p>
          <div className="flex flex-wrap gap-1.5">
            {customTags.map(tag => (
              <span
                key={tag}
                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${TECH_COLOR_CLASSES[getTechTagColor(tag)]}`}
              >
                {tag}
                <button
                  type="button"
                  onClick={() => toggle(tag)}
                  className="opacity-60 hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Input
          placeholder="Добавить свой вариант…"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom() } }}
          maxLength={50}
          className="h-8 text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCustom}
          disabled={!custom.trim() || value.includes(custom.trim()) || value.length >= MAX_TAGS}
        >
          Добавить
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Выбрано: {value.length} / {MAX_TAGS}
      </p>
    </div>
  )
}
