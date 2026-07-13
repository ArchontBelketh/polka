import type { ReactNode } from "react"
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
  // Малые числа отпугивают покупателей — показываем качественные сигналы доверия.
  if (productCount < MIN_FOR_NUMBERS) {
    return (
      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 pb-16 sm:grid-cols-3">
        <TrustItem tint="cyan" label="Автосканирование кода каждого продукта" icon={<ScanLine className="h-5 w-5" />} />
        <TrustItem tint="violet" label="Ручная модерация перед публикацией" icon={<ShieldCheck className="h-5 w-5" />} />
        <TrustItem tint="cyan" label="Мгновенная доставка файлов после оплаты" icon={<ShoppingBag className="h-5 w-5" />} />
      </section>
    )
  }

  return (
    <section className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 pb-16 text-center sm:grid-cols-3">
      <Stat icon={<Package className="h-5 w-5" />} value={productCount} label={plural(productCount, "продукт в каталоге", "продукта в каталоге", "продуктов в каталоге")} />
      <Stat icon={<ScanLine className="h-5 w-5" />} value={scanCount} label={plural(scanCount, "проверка кода", "проверки кода", "проверок кода")} />
      <Stat icon={<ShoppingBag className="h-5 w-5" />} value={salesCount} label={plural(salesCount, "продажа", "продажи", "продаж")} />
    </section>
  )
}

function TrustItem({ tint, label, icon }: { tint: "cyan" | "violet"; label: string; icon: ReactNode }) {
  const box =
    tint === "cyan"
      ? "bg-cyan/[0.08] border-cyan/20 text-cyan"
      : "bg-violet/[0.09] border-violet/[0.22] text-violet"
  return (
    <div className="flex items-center justify-center gap-3">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${box}`}>{icon}</div>
      <span className="max-w-[210px] text-left text-sm leading-snug text-muted-foreground">{label}</span>
    </div>
  )
}

function Stat({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-cyan">{icon}</span>
      <span className="font-display text-3xl font-bold tabular-nums text-foreground">{value.toLocaleString("ru-RU")}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}
