const COMMISSION_RATE = parseFloat(process.env.COMMISSION_RATE ?? "0.20")

/** Сумма к зачислению разработчику: цена минус комиссия площадки. */
export function developerPayout(priceKopecks: number): number {
  return Math.floor(priceKopecks * (1 - COMMISSION_RATE))
}
