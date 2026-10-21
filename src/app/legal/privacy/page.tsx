import type { Metadata } from "next"
import { LegalDoc } from "@/components/legal/LegalDoc"
import { PRIVACY_MD } from "@/content/legal"

export const metadata: Metadata = { title: "Политика обработки персональных данных" }

export default function PrivacyPage() {
  return <LegalDoc source={PRIVACY_MD} />
}
