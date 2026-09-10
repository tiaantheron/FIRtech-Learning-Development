import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"

export function KpiCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string
  value: string | number
  sublabel?: string
  icon?: LucideIcon
  tone?: "default" | "resell" | "services" | "success" | "warning" | "danger"
  className?: string
}) {
  const toneText = {
    default: "text-primary",
    resell: "text-[var(--resell)]",
    services: "text-[var(--services)]",
    success: "text-[var(--success)]",
    warning: "text-[oklch(0.5_0.13_75)]",
    danger: "text-destructive",
  }[tone]

  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon ? <Icon className={cn("h-4 w-4", toneText)} aria-hidden /> : null}
      </div>
      <p className={cn("mt-2 text-2xl font-semibold tabular-nums", toneText)}>{value}</p>
      {sublabel ? <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p> : null}
    </Card>
  )
}
