import { cn } from "@/lib/utils"
import { CATEGORY_LABELS, CATEGORY_ICONS, type Category } from "@/types"

interface CategoryStepProps {
  value: Category | ""
  onChange: (v: Category) => void
}

export function CategoryStep({ value, onChange }: CategoryStepProps) {
  const categories = Object.keys(CATEGORY_LABELS) as Category[]

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Выберите категорию</h2>
        <p className="text-sm text-muted-foreground">
          Выберите категорию, которая лучше всего описывает ваш продукт.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-4 text-left transition-colors",
              value === cat
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card hover:border-primary/50 hover:bg-card/80",
            )}
          >
            <span className="text-2xl">{CATEGORY_ICONS[cat]}</span>
            <span className="font-medium">{CATEGORY_LABELS[cat]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
