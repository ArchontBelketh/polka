import { ForgotForm } from "./ForgotForm"

export const metadata = { title: "Восстановление пароля" }

export default function ForgotPage() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">Восстановление пароля</h1>
          <p className="text-sm text-muted-foreground">
            Укажите email — пришлём ссылку для сброса пароля.
          </p>
        </div>
        <ForgotForm />
      </div>
    </div>
  )
}
