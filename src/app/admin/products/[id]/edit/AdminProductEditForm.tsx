"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CATEGORY_LABELS } from "@/types"
import { saleModelForRub, SALE_MODEL_LABELS, PRICE_THRESHOLD_RUB, formatRub } from "@/lib/tariffs"

export interface AdminProductEditFormProps {
  product: {
    id: string
    title: string
    shortDesc: string
    fullDesc: string
    category: string
    price: number // копейки
    features: string[]
    installGuide: string | null
    requirements: string[]
    targetAudience: string | null
    techStack: string[]
    license: string
    telegramBotUsername: string | null
    developerPaymentInfo: string | null
    demoUrl: string | null
    videoUrl: string | null
  }
}

const LICENSES = [
  { value: "personal", label: "Персональная (1 использование)" },
  { value: "team", label: "Командная (до 5 пользователей)" },
  { value: "commercial", label: "Коммерческая (без ограничений)" },
]

const linesToArr = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean)
const commaToArr = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean)

export function AdminProductEditForm({ product }: AdminProductEditFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [f, setF] = useState({
    title: product.title,
    category: product.category,
    shortDesc: product.shortDesc,
    fullDesc: product.fullDesc,
    targetAudience: product.targetAudience ?? "",
    techStack: product.techStack.join(", "),
    features: product.features.join("\n"),
    installGuide: product.installGuide ?? "",
    requirements: product.requirements.join("\n"),
    price: (product.price / 100).toString(),
    license: product.license,
    telegramBotUsername: product.telegramBotUsername ?? "",
    developerPaymentInfo: product.developerPaymentInfo ?? "",
    demoUrl: product.demoUrl ?? "",
    videoUrl: product.videoUrl ?? "",
  })

  function set<K extends keyof typeof f>(key: K, v: (typeof f)[K]) {
    setF((prev) => ({ ...prev, [key]: v }))
  }

  const priceNum = parseFloat(f.price)
  const validPrice = !isNaN(priceNum) && priceNum > 0
  const model = validPrice ? saleModelForRub(priceNum) : null

  async function handleSave() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: f.title,
          shortDesc: f.shortDesc,
          fullDesc: f.fullDesc,
          category: f.category,
          price: Math.round(priceNum * 100),
          features: linesToArr(f.features),
          installGuide: f.installGuide,
          requirements: linesToArr(f.requirements),
          targetAudience: f.targetAudience || undefined,
          techStack: commaToArr(f.techStack),
          license: f.license,
          telegramBotUsername: f.telegramBotUsername || undefined,
          developerPaymentInfo: f.developerPaymentInfo || undefined,
          demoUrl: f.demoUrl || undefined,
          videoUrl: f.videoUrl || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.formErrors?.join?.(", ") ||
              Object.entries(data.error?.fieldErrors ?? {})
                .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
                .join("; ") ||
              "Проверьте поля формы"
        setError(msg)
        return
      }
      router.push(`/admin/review/${product.id}`)
      router.refresh()
    } catch {
      setError("Ошибка соединения")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Название *</Label>
        <Input id="title" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <p className="text-xs text-muted-foreground">При смене названия обновится URL продукта.</p>
      </div>

      <div className="space-y-2">
        <Label>Категория *</Label>
        <Select value={f.category} onValueChange={(v) => set("category", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="shortDesc">Краткое описание *</Label>
        <Textarea id="shortDesc" rows={2} value={f.shortDesc} onChange={(e) => set("shortDesc", e.target.value)} maxLength={300} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullDesc">Полное описание *</Label>
        <Textarea id="fullDesc" rows={6} value={f.fullDesc} onChange={(e) => set("fullDesc", e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="targetAudience">Целевая аудитория</Label>
        <Input id="targetAudience" value={f.targetAudience} onChange={(e) => set("targetAudience", e.target.value)} maxLength={300} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="techStack">Стек (через запятую)</Label>
        <Input id="techStack" value={f.techStack} onChange={(e) => set("techStack", e.target.value)} placeholder="Python, aiogram, PostgreSQL" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="features">Функции (по одной на строку) *</Label>
        <Textarea id="features" rows={5} value={f.features} onChange={(e) => set("features", e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="requirements">Системные требования (по одному на строку)</Label>
        <Textarea id="requirements" rows={3} value={f.requirements} onChange={(e) => set("requirements", e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="installGuide">Инструкция по установке * (мин. 200 символов)</Label>
        <Textarea id="installGuide" rows={8} value={f.installGuide} onChange={(e) => set("installGuide", e.target.value)} />
        <p className="text-xs text-muted-foreground">{f.installGuide.trim().length} символов</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="price">Цена, ₽ *</Label>
        <Input id="price" type="number" min="1" step="1" value={f.price} onChange={(e) => set("price", e.target.value)} />
        {validPrice && model && (
          <p className="text-xs text-muted-foreground">
            Модель продажи: <b>{SALE_MODEL_LABELS[model]}</b> (порог {formatRub(PRICE_THRESHOLD_RUB)})
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Лицензия</Label>
        <Select value={f.license} onValueChange={(v) => set("license", v)}>
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

      <div className="space-y-2">
        <Label htmlFor="tg">Username демо-бота (Telegram)</Label>
        <Input id="tg" value={f.telegramBotUsername} onChange={(e) => set("telegramBotUsername", e.target.value)} placeholder="demo_bot" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pay">Реквизиты для прямой оплаты (модель «Тариф за размещение»)</Label>
        <Textarea id="pay" rows={3} value={f.developerPaymentInfo} onChange={(e) => set("developerPaymentInfo", e.target.value)} maxLength={2000} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="demoUrl">Демо-ссылка</Label>
          <Input id="demoUrl" value={f.demoUrl} onChange={(e) => set("demoUrl", e.target.value)} placeholder="https://…" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="videoUrl">Видео-ссылка</Label>
          <Input id="videoUrl" value={f.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} placeholder="https://…" />
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3 pt-2">
        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Сохранение…" : "Сохранить"}
        </Button>
        <Button variant="outline" onClick={() => router.push(`/admin/review/${product.id}`)} disabled={loading}>
          Отмена
        </Button>
      </div>
    </div>
  )
}
