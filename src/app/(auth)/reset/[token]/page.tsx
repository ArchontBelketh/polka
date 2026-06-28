import { ResetForm } from "./ResetForm"

export const metadata = { title: "Новый пароль" }

interface ResetPageProps {
  params: Promise<{ token: string }>
}

export default async function ResetPage({ params }: ResetPageProps) {
  const { token } = await params

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">Новый пароль</h1>
          <p className="text-sm text-muted-foreground">Придумайте новый пароль для входа.</p>
        </div>
        <ResetForm token={token} />
      </div>
    </div>
  )
}
