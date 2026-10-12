import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Согласие на передачу контактных данных исполнителям",
  robots: { index: false, follow: false },
}

// ЗАГЛУШКА. Заменить на утверждённый юридический текст согласия на передачу
// контактных данных исполнителям (отдельный документ).
export default function ConsentContactsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">
        Согласие на передачу контактных данных исполнителям
      </h1>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
        Текст документа готовится. Здесь будет размещено отдельное согласие на передачу ваших
        контактных данных отобранным исполнителям для работы по заявке.
      </div>
      <p className="text-sm text-muted-foreground">
        Оператор: ИП Григорьев Игорь Сергеевич, ИНН 771817573332, support@cyberpolka.store.
      </p>
    </div>
  )
}
