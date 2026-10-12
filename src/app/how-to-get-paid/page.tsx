import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

export const metadata: Metadata = {
  title: "Как принимать оплату на ПОЛКЕ",
  description:
    "Покупатель платит автору напрямую по его ссылке. Как самозанятому или ИП подключить приём оплаты, получить платёжную ссылку и выдавать чек.",
  alternates: { canonical: `${APP_URL}/how-to-get-paid` },
}

export default function HowToGetPaidPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Как принимать оплату на ПОЛКЕ
        </h1>
        <p className="text-muted-foreground">
          Покупатель оплачивает товар <b>напрямую вам</b> по вашей ссылке — ПОЛКА оплату за товары
          не принимает и не хранит платёжные данные. Вам нужен способ принимать деньги и выдавать
          покупателю чек. Ниже — два рабочих варианта.
        </p>
      </div>

      {/* Вариант 1 */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Вариант 1. Самозанятый</h2>
        <p className="text-sm text-muted-foreground">
          Подходит, если продаёте как физлицо на НПД. Приём оплаты — через платёжный сервис для
          самозанятых (например, ЮKassa, Robokassa или ЮMoney).
        </p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• Что нужно: статус самозанятого (приложение «Мой налог») и аккаунт в платёжном сервисе.</li>
          <li>• Что получите: платёжную ссылку или форму оплаты — её вставляете в реквизиты.</li>
          <li>• Чек: формируете сами в «Мой налог» на каждую продажу.</li>
        </ul>
      </section>

      {/* Вариант 2 */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Вариант 2. ИП</h2>
        <p className="text-sm text-muted-foreground">
          Подходит при больших оборотах. Расчётный счёт + интернет-эквайринг (например, Т-Банк или
          Точка) с платёжной ссылкой.
        </p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• Что нужно: ИП, расчётный счёт, подключённый интернет-эквайринг.</li>
          <li>• Что получите: платёжную ссылку, где можно задать сумму.</li>
          <li>• Чек: пробивает ваша онлайн-касса (54-ФЗ).</li>
        </ul>
      </section>

      {/* Как подключить */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Что сделать</h2>
        <ol className="space-y-1.5 text-sm text-muted-foreground list-decimal pl-5">
          <li>Подключите приём оплаты одним из способов выше и получите платёжную ссылку.</li>
          <li>Вставьте ссылку в <Link href="/dashboard/requisites" className="text-primary hover:underline">Кабинет → Реквизиты</Link>. Без неё товары нельзя опубликовать.</li>
          <li>После продажи покупатель нажмёт «Я оплатил» — подтвердите получение в разделе «Подтверждения».</li>
        </ol>
      </section>

      {/* Советы */}
      <section className="space-y-3 rounded-lg border border-border bg-muted/40 p-5">
        <h2 className="text-lg font-semibold text-foreground">Советы</h2>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• Лучше ссылка <b>с вводимой суммой</b> — одна подойдёт для товаров с разными ценами.</li>
          <li>• Попросите покупателя указать в комментарии к платежу email или номер заявки — так проще сверить оплату.</li>
          <li>• Чек покупателю и налоги — на вашей стороне; ПОЛКА в расчётах не участвует.</li>
        </ul>
      </section>

      <p className="text-xs text-muted-foreground">
        Названия сервисов приведены как примеры. Подробные пошаговые инструкции и ссылки на подключение
        появятся отдельно.
      </p>

      <Button asChild size="lg">
        <Link href="/dashboard/requisites">Указать реквизиты</Link>
      </Button>
    </div>
  )
}
