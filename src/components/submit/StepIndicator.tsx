import { cn } from "@/lib/utils"

const STEPS = [
  { label: "Категория" },
  { label: "Описание" },
  { label: "Функции" },
  { label: "Медиа" },
  { label: "Цена" },
]

interface StepIndicatorProps {
  current: number // 0-based
}

export function StepIndicator({ current }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                i < current
                  ? "bg-primary text-white"
                  : i === current
                  ? "bg-primary text-white ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {i < current ? "✓" : i + 1}
            </div>
            <span
              className={cn(
                "hidden text-xs sm:block",
                i === current ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                "h-px w-8 sm:w-12 mx-1 mb-4",
                i < current ? "bg-primary" : "bg-border",
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}
