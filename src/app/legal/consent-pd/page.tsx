import type { Metadata } from "next"
import { LegalDoc } from "@/components/legal/LegalDoc"
import { CONSENT_PD_MD } from "@/content/legal"

export const metadata: Metadata = {
  title: "Согласие на обработку персональных данных",
  robots: { index: false, follow: false },
}

export default function ConsentPdPage() {
  return <LegalDoc source={CONSENT_PD_MD} />
}
