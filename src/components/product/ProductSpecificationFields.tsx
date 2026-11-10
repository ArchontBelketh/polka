"use client"

import { PRODUCT_LANGUAGES, PRODUCT_PLATFORMS, type ProductSpecificationInput } from "@/lib/product-specification"
import { Textarea } from "@/components/ui/textarea"

export function ProductSpecificationFields({ value, onChange, idPrefix = "spec" }: {
  value: ProductSpecificationInput; onChange: (value: ProductSpecificationInput) => void; idPrefix?: string
}) {
  function toggle(field: "languages" | "platforms", key: string, checked: boolean) {
    onChange({ ...value, [field]: checked ? [...value[field], key] : value[field].filter((item) => item !== key) })
  }
  return (
    <section aria-labelledby={`${idPrefix}-heading`} className="space-y-5">
      <div><h2 id={`${idPrefix}-heading`} className="text-lg font-semibold">Характеристики и условия</h2><p className="mt-1 text-sm text-muted-foreground">Указывайте проверенные вами сведения. Эти поля видны покупателю до оплаты и используются в фильтрах каталога.</p></div>
      <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Языки программирования</legend><div className="flex flex-wrap gap-2">
        {Object.entries(PRODUCT_LANGUAGES).map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"><input type="checkbox" checked={value.languages.includes(key as typeof value.languages[number])} disabled={value.languages.length >= 5 && !value.languages.includes(key as typeof value.languages[number])} onChange={(event) => toggle("languages", key, event.target.checked)} className="h-4 w-4 accent-primary" />{label}</label>)}
      </div><p className="text-xs text-muted-foreground">До 5 языков. Библиотеки и фреймворки укажите в стеке технологий.</p></fieldset>
      <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Платформы</legend><div className="flex flex-wrap gap-2">
        {Object.entries(PRODUCT_PLATFORMS).map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"><input type="checkbox" checked={value.platforms.includes(key as typeof value.platforms[number])} onChange={(event) => toggle("platforms", key, event.target.checked)} className="h-4 w-4 accent-primary" />{label}</label>)}
      </div></fieldset>
      {([
        ["compatibility", "Совместимость", "Версии ОС, среды, конфигурации 1С или Excel, на которых проверен продукт."],
        ["outcome", "Результат покупки", "Какую задачу решает продукт и что получает покупатель: код, шаблоны, примеры, документацию."],
        ["supportTerms", "Условия поддержки", "Канал связи, объём помощи, срок ответа и ограничения. Не обещайте то, что не сможете выполнить."],
        ["updateTerms", "Условия обновлений", "Какие обновления входят в покупку, как долго и как покупатель их получает."],
      ] as const).map(([key, label, hint]) => <div key={key} className="space-y-2"><label htmlFor={`${idPrefix}-${key}`} className="text-sm font-medium">{label}</label><Textarea id={`${idPrefix}-${key}`} value={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.value })} rows={3} maxLength={2000} aria-describedby={`${idPrefix}-${key}-hint`} /><p id={`${idPrefix}-${key}-hint`} className="text-xs text-muted-foreground">{hint}</p></div>)}
    </section>
  )
}
