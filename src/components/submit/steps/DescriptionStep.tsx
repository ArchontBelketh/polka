import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { TechStackPicker } from "@/components/submit/TechStackPicker"

interface DescriptionData {
  title: string
  shortDesc: string
  fullDesc: string
  targetAudience: string
  techStack: string[]
}

interface DescriptionStepProps {
  value: DescriptionData
  onChange: (v: DescriptionData) => void
}

export function DescriptionStep({ value, onChange }: DescriptionStepProps) {
  function set<K extends keyof DescriptionData>(key: K, v: DescriptionData[K]) {
    onChange({ ...value, [key]: v })
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Описание продукта</h2>
        <p className="text-sm text-muted-foreground">
          Расскажите, что делает ваш продукт. Подробное описание увеличивает конверсию.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Название *</Label>
        <Input
          id="title"
          placeholder="Telegram-бот записи клиентов"
          value={value.title}
          onChange={(e) => set("title", e.target.value)}
          maxLength={120}
          required
        />
        <p className="text-xs text-muted-foreground">{value.title.length}/120</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="shortDesc">Краткое описание * <span className="text-muted-foreground font-normal">(до 300 символов)</span></Label>
        <Textarea
          id="shortDesc"
          placeholder="Одна-две строки о том, что делает продукт и для кого он"
          value={value.shortDesc}
          onChange={(e) => set("shortDesc", e.target.value)}
          maxLength={300}
          rows={2}
          required
        />
        <p className="text-xs text-muted-foreground">{value.shortDesc.length}/300</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullDesc">Полное описание *</Label>
        <Textarea
          id="fullDesc"
          placeholder="Подробно опишите функционал, кейсы использования, что входит в поставку..."
          value={value.fullDesc}
          onChange={(e) => set("fullDesc", e.target.value)}
          rows={6}
          required
        />
        <p className={`text-xs ${value.fullDesc.length >= 30 ? "text-muted-foreground" : "text-destructive"}`}>
          {value.fullDesc.length} символов
          {value.fullDesc.length < 30 && ` — нужно ещё ${30 - value.fullDesc.length}`}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="targetAudience">Целевая аудитория</Label>
        <Input
          id="targetAudience"
          placeholder="Салоны красоты, малый бизнес..."
          value={value.targetAudience}
          onChange={(e) => set("targetAudience", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Стек технологий</Label>
        <TechStackPicker value={value.techStack} onChange={(v) => set("techStack", v)} />
      </div>
    </div>
  )
}
