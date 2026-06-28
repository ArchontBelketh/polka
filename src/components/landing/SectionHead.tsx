import type { ReactNode } from "react"

export function Kicker({ children }: { children: ReactNode }) {
  return <div className="font-mono text-xs uppercase tracking-[0.22em] text-cyan">{children}</div>
}

export function SectionHead({
  kicker,
  title,
  sub,
  wide,
}: {
  kicker: string
  title: string
  sub?: string
  wide?: boolean
}) {
  return (
    <div className="mb-12 text-center">
      <Kicker>{kicker}</Kicker>
      <h2 className="mt-3.5 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {sub && (
        <p className={`mt-2.5 leading-relaxed text-muted-foreground ${wide ? "mx-auto max-w-xl" : ""}`}>
          {sub}
        </p>
      )}
    </div>
  )
}

export function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  )
}
