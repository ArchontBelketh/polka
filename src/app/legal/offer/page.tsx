import type { Metadata } from "next"
import { LegalDoc } from "@/components/legal/LegalDoc"
import { OFFER_MD } from "@/content/legal"

export const metadata: Metadata = { title: "Публичная оферта" }

export default function OfferPage() {
  return <LegalDoc source={OFFER_MD} />
}
