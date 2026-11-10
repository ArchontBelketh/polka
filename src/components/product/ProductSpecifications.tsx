import { PRODUCT_LANGUAGES, PRODUCT_PLATFORMS, specificationInput, type SpecificationRecord } from "@/lib/product-specification"

export function ProductSpecifications({ specification }: { specification?: SpecificationRecord | null }) {
  const value = specificationInput(specification)
  return (
    <section aria-labelledby="product-specifications" className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div><h2 id="product-specifications" className="text-lg font-semibold">Характеристики и условия</h2><p className="mt-1 text-xs text-muted-foreground">Сведения указаны автором. Перед покупкой проверьте, подходят ли они для вашей задачи.</p></div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Языки программирования</dt><dd className="mt-1 text-sm">{value.languages.length ? value.languages.map((key) => PRODUCT_LANGUAGES[key]).join(", ") : "Не указаны"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Платформы</dt><dd className="mt-1 text-sm">{value.platforms.length ? value.platforms.map((key) => PRODUCT_PLATFORMS[key]).join(", ") : "Не указаны"}</dd></div>
        <Detail title="Совместимость" text={value.compatibility} fallback="Автор пока не указал проверенные версии и среды. Уточните совместимость до покупки." />
        <Detail title="Результат покупки" text={value.outcome} fallback="Состав поставки уточняйте в описании и у автора." />
        <Detail title="Поддержка" text={value.supportTerms} fallback="Условия поддержки не указаны. Уточните их у автора до покупки." />
        <Detail title="Обновления" text={value.updateTerms} fallback="Условия предоставления обновлений не указаны." />
      </dl>
    </section>
  )
}

function Detail({ title, text, fallback }: { title: string; text: string; fallback: string }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{title}</dt><dd className={`mt-1 whitespace-pre-line break-words text-sm leading-relaxed ${text ? "text-foreground" : "text-muted-foreground"}`}>{text || fallback}</dd></div>
}
