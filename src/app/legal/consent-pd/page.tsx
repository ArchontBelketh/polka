import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Согласие на обработку персональных данных",
  robots: { index: false, follow: false },
}

// ЗАГЛУШКА. Заменить на утверждённый юридический текст согласия на обработку ПДн
// (отдельный документ, не в оферте — требование с 01.09.2025).
export default function ConsentPdPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">
        Согласие на обработку персональных данных
      </h1>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
        Текст документа готовится. Здесь будет размещено отдельное согласие на обработку
        персональных данных. До публикации утверждённого текста форма приёма заявок работает в
        тестовом режиме.
      </div>
      <p className="text-sm text-muted-foreground">
        Оператор: ИП Григорьев Игорь Сергеевич, ИНН 771817573332, support@cyberpolka.store.
      </p>
    </div>
  )
}
