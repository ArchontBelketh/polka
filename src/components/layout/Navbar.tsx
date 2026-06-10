import Link from "next/link"
import { Search, Package, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { UserMenu } from "@/components/layout/UserMenu"
import { MessageBell } from "@/components/layout/MessageBell"

export async function Navbar() {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  const userId = session?.user?.id

  // Unread message count for the bell (buyer or developer threads)
  let unread = 0
  if (userId) {
    unread = await db.purchaseMessage.count({
      where: {
        isRead: false,
        senderId: { not: userId },
        purchase: { OR: [{ buyerId: userId }, { product: { authorId: userId } }] },
      },
    })
  }
  const messagesHref = role === "DEVELOPER" ? "/dashboard/messages" : "/purchases"

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
          <Package className="h-5 w-5 text-primary" />
          <span>Полка</span>
        </Link>

        <form action="/catalog" className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              name="q"
              placeholder="Поиск продуктов..."
              className="pl-8 bg-muted border-border text-sm h-9"
            />
          </div>
        </form>

        <nav className="ml-auto flex items-center gap-2">
          {session?.user ? (
            <>
              {role === "DEVELOPER" ? (
                <Button asChild size="sm" variant="outline">
                  <Link href="/submit">Загрузить продукт</Link>
                </Button>
              ) : (
                <Link
                  href="/sell"
                  className="hidden text-sm text-muted-foreground hover:text-foreground sm:block"
                >
                  Продавать
                </Link>
              )}
              <MessageBell initialCount={unread} href={messagesHref} />
              <UserMenu role={role} />
            </>
          ) : (
            <>
              <Link
                href="/sell"
                className="hidden text-sm text-muted-foreground hover:text-foreground sm:block"
              >
                Продавать
              </Link>
              <Button asChild size="sm">
                <Link href="/login" className="flex items-center gap-1.5">
                  <LogIn className="h-4 w-4" />
                  Войти
                </Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
