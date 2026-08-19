import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Category } from "@/types"
import {
  PRICE_THRESHOLD_RUB,
  COMMISSION_RATE,
  COMMISSION_PCT,
  LISTING_FEE_RATE,
  LISTING_FEE_PCT,
  saleModelForRub,
  formatRub,
} from "@/lib/tariffs"

interface PricingData {
  price: string
  license: string
  telegramBotUsername: string
  developerPaymentInfo: string
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
  const validPrice = !isNaN(priceNum) && priceNum > 0
  const model = validPrice ? saleModelForRub(priceNum) : null
  const commission = validPrice ? Math.round(priceNum * COMMISSION_RATE) : 0
  const payout = validPrice ? priceNum - commission : 0
  const listingFee = validPrice ? Math.round(priceNum * LISTING_FEE_RATE) : 0

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Цена и лицензия</h2>
        <p className="text-sm text-muted-foreground">
          Модель продажи зависит от цены. Порог — {formatRub(PRICE_THRESHOLD_RUB)}: дешевле —
          оплата через площадку с комиссией {COMMISSION_PCT}%; от порога — прямая продажа с
          единоразовым тарифом за размещение {LISTING_FEE_PCT}%.
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
        {validPrice && model === "COMMISSION" && (
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between text-primary text-xs font-medium mb-1">
              <span>Модель: Комиссия</span>
              <span>оплата через площадку</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Цена</span>
              <span>{priceNum.toLocaleString("ru-RU")} ₽</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Комиссия ПОЛКИ ({COMMISSION_PCT}%)</span>
              <span>−{commission.toLocaleString("ru-RU")} ₽</span>
            </div>
            <div className="flex justify-between font-medium text-foreground border-t border-border pt-1 mt-1">
              <span>Ваша выплата</span>
              <span>≈{payout.toLocaleString("ru-RU")} ₽</span>
            </div>
          </div>
        )}

        {validPrice && model === "LISTING_FEE" && (
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between text-primary text-xs font-medium mb-1">
              <span>Модель: Тариф за размещение</span>
              <span>прямая продажа</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Цена</span>
              <span>{priceNum.toLocaleString("ru-RU")} ₽</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Тариф за размещение ({LISTING_FEE_PCT}%, единоразово)</span>
              <span>{listingFee.toLocaleString("ru-RU")} ₽</span>
            </div>
            <p className="text-xs text-muted-foreground border-t border-border pt-1 mt-1">
              Оплату от покупателя вы получаете <b>напрямую</b> по своим реквизитам; площадка в
              расчётах не участвует. Тариф уплачивается один раз до старта продаж.
            </p>
          </div>
        )}
      </div>

      {validPrice && model === "LISTING_FEE" && (
        <div className="space-y-2">
          <Label htmlFor="paymentInfo">Реквизиты для оплаты покупателем *</Label>
          <Textarea
            id="paymentInfo"
            rows={3}
            placeholder="Например: перевод на карту 0000 0000 0000 0000 (Иван И.), или ссылка на вашу форму оплаты…"
            value={value.developerPaymentInfo}
            onChange={(e) => set("developerPaymentInfo", e.target.value)}
            maxLength={2000}
          />
          <p className="text-xs text-muted-foreground">
            Как покупатель оплатит продукт напрямую вам. Показывается на странице продукта. Оплату
            вы подтверждаете вручную в кабинете, после чего покупателю открывается скачивание.
          </p>
        </div>
      )}

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
