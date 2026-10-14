import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { OrderForm } from "./OrderForm"
import {
  KIND_BY_SLUG, SERVICE_LABELS, SERVICE_TAGLINES, SERVICE_TURNAROUND,
  SERVICE_PRICES, SERVICE_BRIEF_LABEL, needsCode, codeRequired, SLUG_BY_KIND,
  SERVICE_METRICA_GOAL,
} from "@/lib/services"

export const metadata: Metadata = { title: "Заказ услуги", robots: { index: false } }

type SP = { searchParams: Promise<{ kind?: string }> }

export default async function OrderPage({ searchParams }: SP) {
  const { kind: slug } = await searchParams
  const kind = slug ? KIND_BY_SLUG[slug] : undefined
  if (!kind) redirect("/services")

  const session = await auth()
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/services/order?kind=${SLUG_BY_KIND[kind]}`)}`)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">{SERVICE_LABELS[kind]}</h1>
        <p className="text-sm text-muted-foreground">{SERVICE_TAGLINES[kind]}</p>
        <p className="text-sm text-muted-foreground">{SERVICE_TURNAROUND[kind]}</p>
      </div>

      <OrderForm
        kindSlug={SLUG_BY_KIND[kind]}
        price={SERVICE_PRICES[kind]}
        briefLabel={SERVICE_BRIEF_LABEL[kind]}
        briefRequired={kind !== "AI_AUDIT"}
        showFile={needsCode(kind)}
        fileRequired={codeRequired(kind)}
        goal={SERVICE_METRICA_GOAL[kind]}
      />
    </div>
  )
}
