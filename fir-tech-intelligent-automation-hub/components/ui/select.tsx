import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative inline-flex">
      <select
        className={cn(
          "h-9 appearance-none rounded-md border border-border bg-card pl-3 pr-8 text-sm text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring/40",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

