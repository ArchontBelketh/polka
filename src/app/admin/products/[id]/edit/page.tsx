import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { db } from "@/lib/db"
import { AdminProductEditForm } from "./AdminProductEditForm"

export const metadata = { title: "Редактирование продукта" }

type RouteParams = { params: Promise<{ id: string }> }

export default async function AdminProductEditPage({ params }: RouteParams) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) redirect("/")

  const { id } = await params
  const product = await db.product.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      shortDesc: true,
      fullDesc: true,
      category: true,
      price: true,
      features: true,
      installGuide: true,
      requirements: true,
      targetAudience: true,
      techStack: true,
      license: true,
      telegramBotUsername: true,
      developerPaymentInfo: true,
      demoUrl: true,
      videoUrl: true,
    },
  })

  if (!product) notFound()

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <a href={`/admin/review/${product.id}`} className="hover:underline">← К карточке продукта</a>
        </p>
        <h1 className="text-2xl font-semibold">Редактирование продукта</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Изменения применяются сразу. Файлы продукта редактируются отдельно (версии).
        </p>
      </div>

      <AdminProductEditForm product={product} />
    </div>
  )
}
