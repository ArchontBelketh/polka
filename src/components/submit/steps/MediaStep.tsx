"use client"

import { useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface MediaData {
  productFile: File | null
  screenshots: File[]
  demoUrl: string
  videoUrl: string
}

interface MediaStepProps {
  value: MediaData
  onChange: (v: MediaData) => void
}

const ALLOWED_SOURCE = [".zip", ".py", ".js", ".ts", ".epf", ".erf", ".xlsm"]

export function MediaStep({ value, onChange }: MediaStepProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const ssRef = useRef<HTMLInputElement>(null)

  function set<K extends keyof MediaData>(key: K, v: MediaData[K]) {
    onChange({ ...value, [key]: v })
  }

  function handleProductFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    set("productFile", file)
  }

  function handleScreenshots(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 5)
    set("screenshots", [...value.screenshots, ...files].slice(0, 5))
  }

  function removeScreenshot(i: number) {
    set("screenshots", value.screenshots.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Файлы и медиа</h2>
        <p className="text-sm text-muted-foreground">
          Загрузите основной файл продукта и скриншоты.
        </p>
      </div>

      {/* Product file */}
      <div className="space-y-2">
        <Label>
          Файл продукта *{" "}
          <span className="font-normal text-muted-foreground">
            ({ALLOWED_SOURCE.join(", ")} — до 100 МБ)
          </span>
        </Label>
        <div
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 hover:border-primary/50 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          {value.productFile ? (
            <p className="text-sm font-medium text-primary">{value.productFile.name}</p>
          ) : (
            <>
              <p className="text-muted-foreground">Нажмите или перетащите файл</p>
              <p className="text-xs text-muted-foreground mt-1">ZIP-архив, .py, .epf, .xlsm и другие</p>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED_SOURCE.join(",")}
          className="hidden"
          onChange={handleProductFile}
        />
      </div>

      {/* Screenshots */}
      <div className="space-y-2">
        <Label>
          Скриншоты{" "}
          <span className="font-normal text-muted-foreground">(до 5 изображений, JPEG/PNG)</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {value.screenshots.map((f, i) => (
            <div key={i} className="relative group">
              <img
                src={URL.createObjectURL(f)}
                alt=""
                className="h-20 w-32 rounded-md object-cover border border-border"
              />
              <button
                type="button"
                onClick={() => removeScreenshot(i)}
                className="absolute -top-1 -right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white text-xs"
              >
                ×
              </button>
            </div>
          ))}
          {value.screenshots.length < 5 && (
            <button
              type="button"
              onClick={() => ssRef.current?.click()}
              className="h-20 w-32 rounded-md border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary/50 transition-colors"
            >
              +
            </button>
          )}
        </div>
        <input
          ref={ssRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handleScreenshots}
        />
      </div>

      {/* URLs */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="demoUrl">Демо-ссылка</Label>
          <Input
            id="demoUrl"
            type="url"
            placeholder="https://t.me/demo_bot"
            value={value.demoUrl}
            onChange={(e) => set("demoUrl", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="videoUrl">Видео-обзор</Label>
          <Input
            id="videoUrl"
            type="url"
            placeholder="https://youtube.com/watch?v=..."
            value={value.videoUrl}
            onChange={(e) => set("videoUrl", e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
