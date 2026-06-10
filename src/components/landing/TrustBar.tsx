import { Package, ScanLine, ShoppingBag, ShieldCheck } from "lucide-react"

interface TrustBarProps {
  productCount: number
  scanCount: number
  salesCount: number
}

const MIN_FOR_NUMBERS = 20

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

export function TrustBar({ productCount, scanCount, salesCount }: TrustBarProps) {
  // Small numbers scare buyers — show qualitative trust signals instead
  if (productCount < MIN_FOR_NUMBERS) {
    return (
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-8 text-center sm:grid-cols-3">
          <Qualitative icon={<ScanLine className="h-5 w-5" />} text="Автосканирование кода каждого продукта" />
          <Qualitative icon={<ShieldCheck className="h-5 w-5" />} text="Ручная модерация перед публикацией" />
          <Qualitative icon={<ShoppingBag className="h-5 w-5" />} text="Эскроу 7 дней и возврат при проблеме" />
        </div>
      </section>
    )
  }

  return (
    <section className="border-b border-border bg-card/40">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-8 text-center sm:grid-cols-3">
        <Stat
          icon={<Package className="h-5 w-5" />}
          value={productCount}
          label={plural(productCount, "продукт в каталоге", "продукта в каталоге", "продуктов в каталоге")}
        />
        <Stat
          icon={<ScanLine className="h-5 w-5" />}
          value={scanCount}
          label={plural(scanCount, "проверка кода", "проверки кода", "проверок кода")}
        />
        <Stat
          icon={<ShoppingBag className="h-5 w-5" />}
          value={salesCount}
          label={plural(salesCount, "продажа", "продажи", "продаж")}
        />
      </div>
    </section>
  )
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-primary">{icon}</span>
      <span className="text-3xl font-bold tabular-nums text-foreground">{value.toLocaleString("ru-RU")}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

function Qualitative({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-primary">{icon}</span>
      <span className="text-sm text-muted-foreground">{text}</span>
    </div>
  )
}
