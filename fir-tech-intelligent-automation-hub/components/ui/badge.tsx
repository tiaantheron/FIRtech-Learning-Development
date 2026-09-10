import { cn } from "@/lib/utils"

type Variant = "default" | "success" | "warning" | "danger" | "muted" | "resell" | "services" | "outline"

const variants: Record<Variant, string> = {
  default: "bg-primary/10 text-primary border-primary/20",
  success: "bg-[var(--success)]/12 text-[var(--success)] border-[var(--success)]/25",
  warning: "bg-[var(--warning)]/15 text-[oklch(0.45_0.12_75)] border-[var(--warning)]/30",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
  muted: "bg-muted text-muted-foreground border-border",
  resell: "bg-[var(--resell)]/12 text-[var(--resell)] border-[var(--resell)]/25",
  services: "bg-[var(--services)]/12 text-[var(--services)] border-[var(--services)]/25",
  outline: "bg-transparent text-foreground border-border",
}

export function Badge({
  variant = "default",
  className,
  ...props
}: { variant?: Variant } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}

