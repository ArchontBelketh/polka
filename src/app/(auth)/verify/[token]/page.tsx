import { VerifyClient } from "./VerifyClient"

export const metadata = { title: "Подтверждение email — ПОЛКА" }

interface VerifyPageProps {
  params: Promise<{ token: string }>
}

export default async function VerifyPage({ params }: VerifyPageProps) {
  const { token } = await params
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-2xl font-semibold">Подтверждение email</h1>
        <VerifyClient token={token} />
      </div>
    </div>
  )
}
