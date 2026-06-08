"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface ScreenshotSliderProps {
  urls: string[]
  title: string
}

export function ScreenshotSlider({ urls, title }: ScreenshotSliderProps) {
  const [current, setCurrent] = useState(0)

  if (urls.length === 0) return null

  if (urls.length === 1) {
    return (
      <div className="rounded-lg overflow-hidden bg-muted aspect-video">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={urls[0]} alt={title} className="w-full h-full object-cover" />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg overflow-hidden bg-muted aspect-video group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urls[current]}
          alt={`${title} — скриншот ${current + 1}`}
          className="w-full h-full object-cover transition-opacity duration-200"
        />

        <button
          onClick={() => setCurrent((c) => (c - 1 + urls.length) % urls.length)}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
          aria-label="Предыдущий скриншот"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => setCurrent((c) => (c + 1) % urls.length)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
          aria-label="Следующий скриншот"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <div className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
          {current + 1} / {urls.length}
        </div>
      </div>

      {/* Thumbnails */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {urls.map((url, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`shrink-0 h-14 w-20 rounded overflow-hidden border-2 transition-colors ${
              i === current ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Миниатюра ${i + 1}`} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}
