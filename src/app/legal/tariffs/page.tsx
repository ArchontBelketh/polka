import type { Metadata } from "next"
import { LegalDoc } from "@/components/legal/LegalDoc"
import { TARIFFS_MD } from "@/content/legal"

export const metadata: Metadata = { title: "Тарифы" }

export default function TariffsPage() {
  return <LegalDoc source={TARIFFS_MD} />
}
