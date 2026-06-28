import type { Metadata } from "next"
import MaintenancePage from "@/components/maintenance/MaintenancePage"

export const metadata: Metadata = {
  title: "Технические работы",
  robots: { index: false, follow: false },
}

export default function Maintenance() {
  return (
    <MaintenancePage
      supportEmail={process.env.SUPPORT_EMAIL ?? "support@polka.ru"}
      statusUrl={process.env.STATUS_URL ?? "#"}
    />
  )
}
