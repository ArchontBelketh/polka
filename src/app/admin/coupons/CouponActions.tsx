"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function DeactivateButton({ id }: { id: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function deactivate() {
    startTransition(async () => {
      await fetch(`/api/coupons/${id}`, { method: "PATCH" })
      router.refresh()
    })
  }

  return (
    <Button variant="outline" size="sm" onClick={deactivate} disabled={isPending}>
      Деактивировать
    </Button>
  )
}

export function DeleteButton({ id }: { id: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function remove() {
    if (!confirm("Удалить купон? Это действие необратимо.")) return
    startTransition(async () => {
      await fetch(`/api/coupons/${id}`, { method: "DELETE" })
      router.refresh()
    })
  }

  return (
    <Button variant="destructive" size="sm" onClick={remove} disabled={isPending}>
      Удалить
    </Button>
  )
}
