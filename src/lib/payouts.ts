import { db } from "@/lib/db"
import { sendKktReceipt } from "@/lib/cloudkassir"

const TAXATION_USN_INCOME = 1
const OBJECT_PROPERTY_RIGHTS = 14 // имущественное право
const METHOD_FULL = 4 // полный расчёт

function rub(kopecks: number): number {
  return Number((kopecks / 100).toFixed(2))
}

/**
 * Собрать выплату «всё или ничего»: все зачисленные (creditedAt), но ещё не
 * выплаченные (payoutId=null) продажи разработчика. Привязывает их к новой
 * выплате, резервирует сумму с баланса. Возвращает выплату или ошибку.
 */
export async function createPayoutForDeveloper(
  developerId: string,
): Promise<{ id: string; amount: number } | { error: string }> {
  return db.$transaction(async (tx) => {
    const eligible = await tx.purchase.findMany({
      where: {
        product: { authorId: developerId },
        creditedAt: { not: null },
        payoutId: null,
        developerAmount: { not: null },
        status: { in: ["PAID", "DELIVERED"] },
      },
      select: { id: true, developerAmount: true },
    })
    const total = eligible.reduce((s, p) => s + (p.developerAmount ?? 0), 0)
    if (eligible.length === 0 || total <= 0) {
      return { error: "Нет средств к выплате" }
    }

    const payout = await tx.payout.create({
      data: { developerId, amount: total, status: "PENDING" },
    })
    await tx.purchase.updateMany({
      where: { id: { in: eligible.map((p) => p.id) } },
      data: { payoutId: payout.id },
    })
    await tx.user.update({ where: { id: developerId }, data: { balance: { decrement: total } } })

    return { id: payout.id, amount: total }
  })
}

/**
 * Расходный чек по выплате: по одной позиции на каждую продажу (доля
 * разработчика, имущественное право). Отправляется в момент «Выплачено».
 */
export async function fiscalizePayout(payoutId: string): Promise<{ ok: boolean; message?: string }> {
  const payout = await db.payout.findUnique({
    where: { id: payoutId },
    include: {
      developer: { select: { email: true } },
      purchases: {
        select: { id: true, developerAmount: true, product: { select: { title: true } } },
      },
    },
  })
  if (!payout) return { ok: false, message: "Выплата не найдена" }
  if (payout.purchases.length === 0) return { ok: false, message: "Нет позиций для чека" }

  const items = payout.purchases.map((p) => {
    const a = rub(p.developerAmount ?? 0)
    return {
      label: p.product.title.slice(0, 128),
      price: a,
      quantity: 1,
      amount: a,
      vat: null,
      method: METHOD_FULL,
      object: OBJECT_PROPERTY_RIGHTS,
      additionalPositionInfo: `Покупка ${p.id}`,
    }
  })

  const res = await sendKktReceipt({
    type: "Expense",
    email: payout.developer.email ?? undefined,
    items,
    taxationSystem: TAXATION_USN_INCOME,
    amountRub: rub(payout.amount),
    invoiceId: payout.id,
  })

  if (res.ok) {
    await db.payout.update({ where: { id: payoutId }, data: { receiptSent: true } })
  }
  return res
}
