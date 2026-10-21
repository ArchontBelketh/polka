import type { Metadata } from "next"
import { LegalDoc } from "@/components/legal/LegalDoc"
import { CONSENT_CONTACTS_MD } from "@/content/legal"

export const metadata: Metadata = {
  title: "Согласие на передачу контактных данных исполнителям",
  robots: { index: false, follow: false },
}

export default function ConsentContactsPage() {
  return <LegalDoc source={CONSENT_CONTACTS_MD} />
}
