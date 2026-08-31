import { db } from "@/lib/db"
import { sendReceipt, type KktReceipt } from "@/lib/cloudkassir"
import { getKassaSettings, isKassaReady } from "@/lib/kassa-settings"
import { normalizePhone } from "@/lib/payout-profile"

// Фискальные константы под оператора: ИП, УСН «Доходы», ФФД 1.2.
const TAXATION_USN_INCOME = 1
const VAT_NONE = null // НДС не облагается (УСН)
const METHOD_FULL = 4 // полный расчёт
const OBJECT_SERVICE = 4 // услуга
const OBJECT_PROPERTY_RIGHT = 14 // имущественное право (товар)
const AGENT_ATTORNEY = 4 // поверенный

function rub(kopecks: number): number {
  return Number((kopecks / 100).toFixed(2))
}

/**
 * Чек за собственную услугу оператора: Pro/слоты/AI-ревью/тариф (Чек В) и
 * комиссия оператора (Чек Б). Продавец — оператор, без агентских тегов.
 */
export async function fiscalizeService(params: {
  label: string
  amountKopecks: number
  email: string | null
  invoiceId?: string
}): Promise<void> {
  if (!params.email || params.amountKopecks <= 0) return
  const s = await getKassaSettings()
  if (!isKassaReady(s)) return

  const amount = rub(params.amountKopecks)
  const receipt: KktReceipt = {
    Email: params.email,
    TaxationSystem: TAXATION_USN_INCOME,
    Amounts: { Electronic: amount },
    Items: [
      {
        Label: params.label.slice(0, 124),
        Price: amount,
        Quantity: 1,
        Amount: amount,
        Vat: VAT_NONE,
        Method: METHOD_FULL,
        Object: OBJECT_SERVICE,
      },
    ],
  }
  await sendReceipt({ type: "Income", receipt, invoiceId: params.invoiceId })
}

/**
 * Чеки по продаже товара (Комиссия): агентский Чек А покупателю (оператор —
 * поверенный, поставщик — разработчик) + Чек Б оператору за комиссию.
 * developerAmountKopecks — сумма к выплате разработчику; комиссия = цена − выплата.
 */
export async function fiscalizePurchase(purchaseId: string, developerAmountKopecks: number): Promise<void> {
  const s = await getKassaSettings()
  if (!isKassaReady(s)) return

  const purchase = await db.purchase.findUnique({
    where: { id: purchaseId },
    select: {
      amount: true,
      buyer: { select: { email: true } },
      product: {
        select: {
          title: true,
          author: { select: { email: true, payoutProfile: true } },
        },
      },
    },
  })
  if (!purchase) return

  const profile = purchase.product.author.payoutProfile
  const buyerEmail = purchase.buyer.email
  const title = purchase.product.title

  // Чек А — агентский, покупателю (нужны данные поставщика-разработчика)
  if (profile && buyerEmail) {
    const amount = rub(purchase.amount)
    const phone = profile.phone ? normalizePhone(profile.phone) ?? undefined : undefined
    const receiptA: KktReceipt = {
      Email: buyerEmail,
      TaxationSystem: TAXATION_USN_INCOME,
      Amounts: { Electronic: amount },
      Items: [
        {
          Label: title.slice(0, 124),
          Price: amount,
          Quantity: 1,
          Amount: amount,
          Vat: VAT_NONE,
          Method: METHOD_FULL,
          Object: OBJECT_PROPERTY_RIGHT,
          AgentSign: AGENT_ATTORNEY,
          PurveyorData: {
            Name: profile.displayName,
            Inn: profile.inn,
            ...(phone ? { Phone: phone } : {}),
          },
        },
      ],
    }
    await sendReceipt({ type: "Income", receipt: receiptA, invoiceId: purchaseId })
  } else {
    console.warn("[receipts] Чек А не сформирован: нет данных поставщика/почты", purchaseId)
  }

  // Чек Б — оператору за комиссию (разработчик «покупает» услугу площадки)
  const commissionKopecks = purchase.amount - developerAmountKopecks
  await fiscalizeService({
    label: `Услуги площадки (комиссия) по продаже «${title}»`,
    amountKopecks: commissionKopecks,
    email: purchase.product.author.email,
    invoiceId: `${purchaseId}-commission`,
  })
}
