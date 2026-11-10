// Primary destinations for both marketplace directions.
export const PRIMARY_NAVIGATION = [
  { href: "/orders", label: "Заказы" },
  { href: "/catalog", label: "Готовый код" },
  { href: "/developers", label: "Разработчики" },
] as const

export function isNavigationActive(pathname: string, href: string) {
  if (href === "/orders") return pathname === href || pathname.startsWith("/orders/")
  if (href === "/catalog") return pathname === href || pathname.startsWith("/product/")
  if (href === "/developers") return pathname === href || pathname.startsWith("/developer/")
  return pathname === href
}
