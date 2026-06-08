import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Category } from "@/types"

interface PricingData {
  price: string
  license: string
  telegramBotUsername: string
}

interface PricingStepProps {
  value: PricingData
  category: Category | ""
  onChange: (v: PricingData) => void
}

const LICENSES = [
  { value: "personal", label: "Персональная лицензия (1 использование)" },
  { value: "team", label: "Командная лицензия (до 5 пользователей)" },
  { value: "commercial", label: "Коммерческая (без ограничений)" },
]

export function PricingStep({ value, category, onChange }: PricingStepProps) {
  function set<K extends keyof PricingData>(key: K, v: PricingData[K]) {
    onChange({ ...value, [key]: v })
  }

  const priceNum = parseFloat(value.price)
  const commission = isNaN(priceNum) ? 0 : Math.round(priceNum * 0.2)
  const payout = isNaN(priceNum) ? 0 : priceNum - commission

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Цена и лицензия</h2>
        <p className="text-sm text-muted-foreground">
          Комиссия платформы — 20%. Выплата происходит через 7 дней после покупки.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="price">Цена в рублях *</Label>
        <div className="relative">
          <Input
            id="price"
            type="number"
            min="100"
            max="999999"
            step="100"
            placeholder="4900"
            value={value.price}
            onChange={(e) => set("price", e.target.value)}
            className="pr-8"
            required
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            ₽
          </span>
        </div>
        {!isNaN(priceNum) && priceNum > 0 && (
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Цена</span>
              <span>{priceNum.toLocaleString("ru-RU")} ₽</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Комиссия ПОЛКИ (20%)</span>
              <span>−{commission.toLocaleString("ru-RU")} ₽</span>
            </div>
            <div className="flex justify-between font-medium text-foreground border-t border-border pt-1 mt-1">
              <span>Ваша выплата</span>
              <span>≈{payout.toLocaleString("ru-RU")} ₽</span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Тип лицензии</Label>
        <Select value={value.license} onValueChange={(v) => set("license", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LICENSES.map((l) => (
              <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {category === "TELEGRAM" && (
        <div className="space-y-2">
          <Label htmlFor="tgUsername">Username демо-бота</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
            <Input
              id="tgUsername"
              placeholder="demo_booking_bot"
              value={value.telegramBotUsername}
              onChange={(e) => set("telegramBotUsername", e.target.value)}
              className="pl-7"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Позволяет покупателям протестировать бот до покупки
          </p>
        </div>
      )}

      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm">
        <p className="font-medium text-yellow-400">После отправки</p>
        <p className="text-muted-foreground mt-1">
          Файл будет автоматически проверен на безопасность. Затем модератор рассмотрит продукт
          (обычно 1–2 рабочих дня) и опубликует его в каталоге.
        </p>
      </div>
    </div>
  )
}
