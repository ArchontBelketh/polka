import { ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

interface VerifiedBadgeProps {
  className?: string
  compact?: boolean
}

export function VerifiedBadge({ className, compact = false }: VerifiedBadgeProps) {
  return (
    <span
      title="Модератор ПОЛКИ установил и запустил этот продукт"
      className={cn(
        "inline-flex items-center gap-1 rounded border border-green-500/30 bg-green-500/10 font-medium text-green-400",
        compact ? "px-1 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-xs",
        className,
      )}
    >
      <ShieldCheck className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {compact ? "Проверено" : "Проверено вручную"}
    </span>
  )
}
