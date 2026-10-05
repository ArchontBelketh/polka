"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BecomeDeveloperButton } from "./BecomeDeveloperButton"
import { reachGoal } from "@/lib/metrica"

/**
 * CTA на странице /sell, зависит от роли:
 *  - разработчик/админ → «Загрузить продукт» (/submit);
 *  - покупатель → «Стать разработчиком» (апгрейд роли);
 *  - гость → регистрация/вход.
 * Клики по CTA отправляют цели в Метрику (воронка привлечения разработчиков).
 */
export function SellCta({ role }: { role?: string }) {
  if (role && role !== "BUYER") {
    return (
      <Button asChild size="lg">
        <Link
          href="/submit"
          className="flex items-center gap-2"
          onClick={() => reachGoal("sell_cta_submit")}
        >
          Разместить первый продукт
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    )
  }

  if (role === "BUYER") {
    return <BecomeDeveloperButton />
  }

  // гость
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Button asChild size="lg">
        <Link
          href="/register?role=developer"
          className="flex items-center gap-2"
          onClick={() => reachGoal("sell_cta_register")}
        >
          Разместить первый продукт
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
      <Button asChild size="lg" variant="outline">
        <Link href="/login">Войти</Link>
      </Button>
    </div>
  )
}
