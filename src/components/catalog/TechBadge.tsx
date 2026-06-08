import { TECH_COLOR_CLASSES, getTechTagColor } from "@/lib/tech-tags"

export function TechBadge({ label }: { label: string }) {
  const cls = TECH_COLOR_CLASSES[getTechTagColor(label)]
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  )
}
