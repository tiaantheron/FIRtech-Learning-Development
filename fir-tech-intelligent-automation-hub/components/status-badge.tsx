import { Badge } from "@/components/ui/badge"

// Maps free-text statuses from the workbook to visual tones.
export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  let variant: "default" | "success" | "warning" | "danger" | "muted" = "muted"

  if (["passed", "completed", "active", "achieved", "qualified", "closed won", "won", "submitted"].some((k) => s.includes(k))) {
    variant = "success"
  } else if (["outstanding", "in progress", "exam scheduled", "awaiting result", "scheduled", "nurturing", "negotiation", "proposal", "pending"].some((k) => s.includes(k))) {
    variant = "warning"
  } else if (["failed", "expired", "closed lost", "lost", "not qualified", "overdue"].some((k) => s.includes(k))) {
    variant = "danger"
  } else if (["maintain", "new", "qualification"].some((k) => s.includes(k))) {
    variant = "default"
  } else if (["not allocated", "not started", "allocated", "waived", "not applicable", "on leave"].some((k) => s.includes(k))) {
    variant = "muted"
  }

  return <Badge variant={variant}>{status || "—"}</Badge>
}

