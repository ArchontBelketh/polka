import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/current-user"
import { JobForm } from "@/components/jobs/JobForm"

export const metadata = { title: "Разместить заказ", robots: { index: false, follow: false } }
export default async function NewOrderPage() {
  if (!await getCurrentUser()) redirect("/login?callbackUrl=/orders/new")
  return <div className="mx-auto max-w-3xl px-4 py-8 space-y-6"><h1 className="text-3xl font-semibold">Разместить заказ</h1><JobForm /></div>
}
