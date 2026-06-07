import Link from "next/link"
import { Search, Package, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { auth } from "@/lib/auth"

export async function Navbar() {
  const session = await auth()

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link href="/catalog" className="flex items-center gap-2 font-semibold text-foreground">
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
              {(session.user as { role?: string }).role === "DEVELOPER" && (
                <Button asChild size="sm" variant="outline">
                  <Link href="/submit">Загрузить продукт</Link>
                </Button>
              )}
              <Button asChild size="sm" variant="ghost">
                <Link href="/dashboard">Кабинет</Link>
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login" className="flex items-center gap-1.5">
                <LogIn className="h-4 w-4" />
                Войти
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}
