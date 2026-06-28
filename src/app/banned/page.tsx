import { signOut } from "@/lib/auth"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Аккаунт заблокирован" }

export default function BannedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="text-5xl">🚫</div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Аккаунт заблокирован</h1>
          <p className="text-sm text-muted-foreground">
            Ваш аккаунт был заблокирован администратором платформы.
            Если вы считаете, что это ошибка, свяжитесь с поддержкой.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/support">Написать в поддержку</a>
          </Button>
          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/login" })
            }}
          >
            <Button type="submit" variant="ghost" size="sm" className="w-full text-muted-foreground">
              Выйти из аккаунта
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
