import type { Metadata } from "next"
import { LegalDoc } from "@/components/legal/LegalDoc"
import { TERMS_MD } from "@/content/legal"

export const metadata: Metadata = { title: "Пользовательское соглашение" }

export default function TermsPage() {
  return <LegalDoc source={TERMS_MD} />
}
