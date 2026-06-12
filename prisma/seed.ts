/**
 * Reference-data seed — safe to run in production.
 *
 * The data model has no reference tables to seed (categories, statuses and
 * roles are Prisma enums), so this is intentionally a no-op. Demo content and
 * test accounts live in dev-only scripts that refuse to run in production:
 *
 *   npm run db:seed:demo                 # demo developer + sample products
 *   npx tsx scripts/seed-test-users.ts   # admin/dev/buyer/moderator test logins
 *
 * Create a real production admin with a strong password via:
 *   npx tsx scripts/create-admin.ts --email admin@your-domain --password '...'
 */
console.log(
  "Справочных данных для сидинга нет. Демо-данные: npm run db:seed:demo. " +
    "Реальный админ: npx tsx scripts/create-admin.ts --email ...",
)
