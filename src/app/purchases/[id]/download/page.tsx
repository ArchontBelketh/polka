import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Download, ArrowLeft, ShieldCheck, DatabaseBackup, Server,
  KeyRound, ScanLine, BookOpen, AlertTriangle, LifeBuoy,
} from "lucide-react"

type RouteParams = { params: Promise<{ id: string }> }

export const metadata = { title: "Скачивание" }

const SAFETY_RULES = [
  {
    icon: DatabaseBackup,
    title: "Сделайте резервную копию",
    text: "Перед первым запуском сохраните копию важных данных и рабочих файлов — на случай, если что-то пойдёт не так.",
  },
  {
    icon: Server,
    title: "Запускайте в изолированной среде",
    text: "Проверяйте продукт в виртуальной машине, отдельном контейнере или тестовом аккаунте, а не на рабочей системе с доступом к реальным данным.",
  },
  {
    icon: KeyRound,
    title: "Не выдавайте лишних прав",
    text: "Запускайте без прав администратора, если это явно не требуется. Не вводите пароли и токены от реальных сервисов, пока не убедитесь, что всё чисто.",
  },
  {
    icon: ScanLine,
    title: "Проверьте своим антивирусом",
    text: "Площадка сканирует код, но дополнительная локальная проверка файла перед запуском не бывает лишней.",
  },
  {
    icon: BookOpen,
    title: "Прочитайте инструкцию и требования",
    text: "Убедитесь, что система соответствует требованиям продукта, и следуйте инструкции по установке от разработчика.",
  },
]

export default async function DownloadPage({ params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params

  const purchase = await db.purchase.findUnique({
    where: { id },
    include: { product: { select: { title: true, slug: true, status: true } } },
  })
  if (!purchase) notFound()

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  const isStaff = user?.role === "ADMIN" || user?.role === "MODERATOR"
  if (purchase.buyerId !== session.user.id && !isStaff) notFound()

  // Скачивание доступно только для оплаченных/доставленных покупок
  if (purchase.status !== "PAID" && purchase.status !== "DELIVERED") {
    redirect(`/purchases/${id}`)
  }

  const { product } = purchase
  // Снятый с публикации продукт недоступен даже прошлым покупателям (сотрудники — в обход, для проверки)
  const blocked = product.status === "SUSPENDED" && !isStaff

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <Link
        href={`/purchases/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        К покупке
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Скачивание</h1>
        <p className="text-muted-foreground mt-1">{product.title}</p>
      </div>

      {blocked ? (
        /* ─── Запрет скачивания ─────────────────────────────────────── */
        <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Продукт недоступен для скачивания</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Этот продукт снят с публикации модерацией CYBERПОЛКИ, поэтому скачивание
              сейчас закрыто — в том числе для тех, кто его уже приобрёл. Обычно это
              временная мера: так бывает, когда к продукту появились вопросы по
              безопасности или качеству, и мы их проверяем. Если продукт восстановят,
              скачивание снова откроется.
            </p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Считаете, что это ошибка, или хотите вернуть средства? Напишите в поддержку —
              разберёмся.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <Button asChild variant="outline">
              <Link href={`/purchases/${id}`}>К покупке</Link>
            </Button>
            <Button asChild>
              <Link href="/support" className="flex items-center gap-1.5">
                <LifeBuoy className="h-4 w-4" />
                Обратиться в поддержку
              </Link>
            </Button>
          </div>
        </section>
      ) : (
        /* ─── Инструктаж по безопасности + скачивание ───────────────── */
        <>
          {isStaff && product.status === "SUSPENDED" && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
              Продукт снят с публикации. Скачивание доступно вам как сотруднику — для проверки.
            </div>
          )}

          <section className="rounded-lg border border-border bg-card p-6 space-y-5">
            <div className="space-y-2">
              <h2 className="font-semibold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Перед скачиванием — правила безопасности
              </h2>
              <p className="text-sm text-muted-foreground">
                CYBERПОЛКА автоматически сканирует код и проверяет продукты вручную, но ни одна
                проверка не даёт стопроцентной гарантии. Готовый код с площадки — как и любой код
                из интернета — запускайте осознанно.
              </p>
            </div>

            <ul className="space-y-4">
              {SAFETY_RULES.map((rule) => (
                <li key={rule.title} className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <rule.icon className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">{rule.title}</p>
                    <p className="text-sm text-muted-foreground">{rule.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-6">
            <Button asChild size="lg">
              {/* Обычная ссылка на GET-роут: сервер выдаёт одноразовый S3-URL и редиректит */}
              <a href={`/api/download/${purchase.id}`} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Скачать
              </a>
            </Button>
            <p className="text-xs text-muted-foreground text-center max-w-md">
              Нажимая «Скачать», вы подтверждаете, что ознакомились с правилами безопасности
              выше и скачиваете продукт под свою ответственность.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
