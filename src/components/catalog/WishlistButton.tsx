"use client"

import { useState, useTransition } from "react"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"

interface WishlistButtonProps {
  productId: string
  initialSaved: boolean
  className?: string
}

export function WishlistButton({ productId, initialSaved, className }: WishlistButtonProps) {
  const [saved, setSaved] = useState(initialSaved)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        })
        if (res.status === 401) return // not logged in — silently ignore
        const data = await res.json()
        if (res.ok) setSaved(data.saved)
      } catch {
        // ignore network errors
      }
    })
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle()
      }}
      disabled={isPending}
      className={cn(
        "rounded-full p-1.5 transition-colors",
        saved
          ? "text-red-500 hover:text-red-400"
          : "text-muted-foreground hover:text-red-400",
        className
      )}
      aria-label={saved ? "Убрать из избранного" : "Добавить в избранное"}
    >
      <Heart className={cn("h-4 w-4", saved && "fill-current")} />
    </button>
  )
}
