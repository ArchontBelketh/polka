/**
 * Guard for dev-only seed scripts. Throws in production unless the operator
 * explicitly opts in with ALLOW_DEMO_SEED=1. Prevents demo products and
 * test accounts (known passwords) from ever landing on a production database.
 */
export function assertNotProduction(what = "Демо-сид"): void {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_DEMO_SEED) {
    throw new Error(
      `${what} запрещён в production. Если это осознанное действие — установите ALLOW_DEMO_SEED=1.`,
    )
  }
}
