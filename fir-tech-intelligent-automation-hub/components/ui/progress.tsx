import { cn } from "@/lib/utils"
import { clampPct } from "@/lib/utils/format"

export function Progress({
  value,
  tone = "primary",
  className,
}: {
  value: number // 0..1
  tone?: "primary" | "resell" | "services" | "success" | "warning"
  className?: string
}) {
  const pct = clampPct(value) * 100
  const toneClass = {
    primary: "bg-primary",
    resell: "bg-[var(--resell)]",
    services: "bg-[var(--services)]",
    success: "bg-[var(--success)]",
    warning: "bg-[var(--warning)]",
  }[tone]
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-all", toneClass)}
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  )
}

