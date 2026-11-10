import { cn } from "@/lib/utils"

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2.5", className)}>
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet/30 bg-card shadow-[0_0_20px_-8px_var(--deep)]">
        <span className="flex flex-col gap-1">
          <span className="flex items-end gap-1">
            <span className="font-mono text-sm font-extrabold leading-none text-violet">&gt;</span>
            <span className="flex items-end gap-0.5">
              <span className="h-2 w-1 rounded-sm bg-cyan" />
              <span className="h-3 w-1 rounded-sm bg-violet" />
            </span>
          </span>
          <span className="h-0.5 w-6 rounded-full bg-deep" />
        </span>
      </span>
      <span className="font-display text-base font-bold tracking-wide sm:text-lg">
        <span className="text-cyan">CYBER</span><span className="text-foreground">ПОЛКА</span>
      </span>
    </span>
  )
}
